const $ = (id) => document.getElementById(id);
const initial = window.PUBLISHED_CATALOG;
if (!initial || !Array.isArray(initial.days) || !Array.isArray(initial.folders) || !Array.isArray(initial.media)) {
  throw new Error('Không tìm thấy danh mục ảnh/video. Kiểm tra data/catalog.js.');
}

const state = {
  catalog: structuredClone(initial),
  editing: false,
  hasDraft: false,
  fileTargetFolder: null,
  captionQueue: [],
  objectUrls: new Map(),
  toastTimer: null,
  exportBusy: false
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function safeHref(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
function mediaSrc(media) {
  if (media.blobKey) return state.objectUrls.get(media.id) || '';
  const path = String(media.src || '');
  if (!path.startsWith('media/') || path.includes('..') || path.includes('\\') || /[?#]/.test(path)) return '';
  return `./${path}`;
}
function formDate(date) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}
function surveyDayLabel(dayId) {
  const day = state.catalog.days.find((entry) => entry.id === dayId);
  return day ? `Ngày ${day.number} · ${day.date}` : '';
}
function formattedCoordinates(media) {
  const latitude = String(media.latitude ?? '').trim();
  const longitude = String(media.longitude ?? '').trim();
  if (!latitude || !longitude) return '';
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return '';
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}
function mimeKind(file) {
  if (['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(file.type)) return 'image';
  if (['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)) return 'video';
  const ext = file.name.toLowerCase().split('.').pop();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  return '';
}
function slugify(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 54) || 'minh-chung';
}
function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().slice(0, 12);
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
function pathFor(dayId, folderId, file) {
  const lastDot = file.name.lastIndexOf('.');
  const filename = lastDot > 0 ? file.name.slice(0, lastDot) : file.name;
  const extension = lastDot > 0 ? file.name.slice(lastDot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  return `media/${dayId}/${folderId}/${uid()}-${slugify(filename)}.${extension || (mimeKind(file) === 'video' ? 'mp4' : 'jpg')}`;
}
function pathForHash(...segments) { return `#/${segments.map(encodeURIComponent).join('/')}`; }
function parseRoute() {
  let parts;
  try { parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent); }
  catch { parts = []; }
  return { dayId: parts[0] || '', folderId: parts[1] || '', mediaId: parts[2] || '' };
}
function toast(message) {
  const el = $('toast');
  clearTimeout(state.toastTimer);
  el.textContent = message;
  el.classList.add('show');
  state.toastTimer = setTimeout(() => el.classList.remove('show'), 4000);
}
function allFolders(dayId) { return state.catalog.folders.filter((x) => x.dayId === dayId); }
function allMedia(folderId) { return state.catalog.media.filter((x) => x.folderId === folderId); }
function dayMediaCount(dayId) { return allFolders(dayId).reduce((sum, folder) => sum + allMedia(folder.id).length, 0); }

async function hydrateObjectUrls() {
  for (const media of state.catalog.media) {
    if (media.blobKey && !state.objectUrls.has(media.id)) {
      try {
        const file = await readFile(media.blobKey);
        if (file) state.objectUrls.set(media.id, URL.createObjectURL(file));
      } catch (error) { console.warn('Không mở được tệp ảnh/video đã lưu:', error); }
    }
  }
}
function purgeObjectUrls() {
  const known = new Set(state.catalog.media.map((x) => x.id));
  for (const [id, url] of state.objectUrls) {
    if (!known.has(id)) { URL.revokeObjectURL(url); state.objectUrls.delete(id); }
  }
}
function updateRibbon() {
  $('manage-button').setAttribute('aria-pressed', String(state.editing));
  $('manage-button').innerHTML = state.editing ? '<span aria-hidden="true">✓</span> Đang quản lý' : '<span aria-hidden="true">✎</span> Quản lý kho';
  const ribbon = $('editor-ribbon');
  ribbon.hidden = !state.editing && !state.hasDraft;
  const message = ribbon.querySelector('span');
  if (message) message.innerHTML = state.editing
    ? '<strong>Đang quản lý trên thiết bị này.</strong> Thay đổi chưa hiển thị công khai cho đến khi đăng gói cập nhật lên GitHub.'
    : '<strong>Đây là bản nháp trên máy này.</strong> Mọi người xem trang đã xuất bản sẽ chưa thấy các thay đổi của bạn.';
}
async function saveDraftAndRender() {
  await writeDraft(state.catalog);
  state.hasDraft = true;
  purgeObjectUrls();
  await render();
}

function heroIllustration() {
  return `<div class="hero-illustration" aria-hidden="true">
  <svg viewBox="0 0 430 430" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="219" cy="207" r="171" stroke="#61817C" stroke-opacity=".37" stroke-width="1.4" stroke-dasharray="3 9"/>
    <circle cx="219" cy="207" r="128" stroke="#E9BF7B" stroke-opacity=".20"/>
    <path d="M74 316C116 274 144 307 168 271C195 231 135 217 178 181C204 158 258 185 277 136C292 96 336 90 364 64" stroke="#E9BF7B" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="2 11"/>
    <circle cx="76" cy="314" r="9" fill="#E9BF7B" stroke="#163D41" stroke-width="5"/>
    <circle cx="169" cy="271" r="8" fill="#80B6A1" stroke="#163D41" stroke-width="5"/>
    <circle cx="178" cy="181" r="8" fill="#E9BF7B" stroke="#163D41" stroke-width="5"/>
    <circle cx="275" cy="140" r="8" fill="#80B6A1" stroke="#163D41" stroke-width="5"/>
    <circle cx="363" cy="64" r="9" fill="#E9BF7B" stroke="#163D41" stroke-width="5"/>
    <path d="M220 74l9 25 25 9-25 9-9 25-9-25-25-9 25-9z" fill="#F1CF9B" opacity=".9"/>
    <path d="M99 95l5 14 14 5-14 5-5 14-5-14-14-5 14-5z" fill="#E1B374" opacity=".4"/>
    <path d="M310 294l7 18 18 7-18 7-7 18-7-18-18-7 18-7z" fill="#F1CF9B" opacity=".65"/>
    <rect x="83" y="340" width="130" height="36" rx="18" fill="#E6F0E9"/>
    <text x="148" y="363" fill="#234D49" font-family="Arial, sans-serif" font-weight="700" font-size="13" text-anchor="middle">13—20.09.2026</text>
    <text x="198" y="228" fill="#F5D5A1" font-size="83" font-family="Georgia, serif" text-anchor="middle">8</text>
    <text x="198" y="258" fill="#DCEBE4" font-size="15" font-weight="700" font-family="Arial, sans-serif" text-anchor="middle" letter-spacing="4">NGÀY</text>
  </svg><div class="hero-caption">21 điểm khảo sát gợi ý</div></div>`;
}

function renderHome() {
  const days = state.catalog.days;
  const folders = state.catalog.folders.length;
  const media = state.catalog.media.length;
  return `<section class="hero"><div class="container"><div class="hero-copy">
      <p class="eyebrow">PHỤ LỤC 3 · KHO MINH CHỨNG THỰC ĐỊA</p>
      <h1>Đi qua miền <em>di sản.</em><br/>Giữ lại từng khoảnh khắc.</h1>
      <p class="hero-description">Hành trình 8 ngày 7 đêm qua những miền đất, di tích và cảnh quan đặc sắc. Khám phá ảnh và video theo từng ngày, từng địa điểm khảo sát.</p>
      <div class="hero-actions"><button type="button" class="btn btn-primary" data-action="scroll-days">Khám phá 8 ngày</button><button type="button" class="btn btn-outline" data-action="help">Cách sử dụng kho ảnh</button></div>
    </div>${heroIllustration()}</div></section>
    <div class="stats-strip"><div class="container stats-grid">
      <div class="stat"><strong class="stat-number">8</strong><span class="stat-label">Ngày khảo sát<br/>13–20/09/2026</span></div>
      <div class="stat"><strong class="stat-number">${folders}</strong><span class="stat-label">Thư mục<br/>địa điểm</span></div>
      <div class="stat"><strong class="stat-number">${media}</strong><span class="stat-label">Ảnh và video<br/>đã lưu</span></div>
    </div></div>
    <section class="section container" id="hanh-trinh"><div class="section-heading"><div><p class="eyebrow">CHỌN CHẶNG KHẢO SÁT</p><h2>8 ngày, một hành trình đáng nhớ</h2><p>Mỗi ngày là một tập hợp các điểm đến. Chọn ngày để khám phá những thư mục minh chứng bên trong.</p></div><span class="section-aside">LỊCH SỬ · ĐỊA LÍ · VĂN HÓA</span></div>
      <div class="day-grid">${days.map((day) => `<a class="day-card" href="${pathForHash(day.id)}" style="--day-color:${escapeHtml(day.color)}"><div class="day-card-art"><span class="day-badge">Ngày ${day.number}</span><span class="day-date">${escapeHtml(day.date)}</span><span class="day-ornament" aria-hidden="true">${['✺','✦','❋','✳','✤','✿','❖','✧'][day.number - 1] || '✦'}</span></div><div class="day-card-body"><span class="day-card-kicker">NHẬT KÝ THỰC ĐỊA · K49</span><h3>${escapeHtml(day.title)}</h3><p>${escapeHtml(day.summary)}</p><div class="day-card-foot"><span>${allFolders(day.id).length} điểm · ${dayMediaCount(day.id)} minh chứng</span><span class="go">Khám phá <span aria-hidden="true">✦</span></span></div></div></a>`).join('')}</div>
    </section>
    <section class="container note-section"><div class="note-card"><div><h3>Minh chứng gắn với trải nghiệm thực tế</h3><p>Ảnh và video trong kho được nhóm bổ sung theo địa điểm khảo sát. Mỗi minh chứng có thể kèm tên, ngày ghi hình, người thực hiện, chú thích và liên kết bản đồ.</p></div><button type="button" class="btn btn-primary" data-action="help">Xem hướng dẫn</button></div></section>`;
}

function breadcrumbs(items) {
  return `<nav class="breadcrumbs" aria-label="Đường dẫn">${items.map((item, idx) => `${idx ? '<span class="divider-dot">/</span>' : ''}${item.href ? `<a href="${item.href}">${escapeHtml(item.label)}</a>` : `<span aria-current="page">${escapeHtml(item.label)}</span>`}`).join('')}</nav>`;
}
function headerForDetail(day, title, description, extra = '') {
  return `<div class="detail-hero" style="--accent:${escapeHtml(day.color)}"><p class="eyebrow">${escapeHtml(extra || `NGÀY ${day.number} · ${day.date}`)}</p><h1 class="detail-title">${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><div class="detail-actions"><button type="button" class="btn btn-outline btn-small" data-action="copy-link">Sao chép liên kết</button><button type="button" class="btn btn-outline btn-small" data-action="qr">Lấy mã QR</button></div></div>`;
}

function folderCard(folder, day) {
  const count = allMedia(folder.id).length;
  return `<a class="folder-card" href="${pathForHash(day.id, folder.id)}" style="--accent:${escapeHtml(day.color)}"><div class="folder-top"><div class="folder-glyph" aria-hidden="true">▤</div><span class="folder-quantity">${count} tệp</span></div><h3>${escapeHtml(folder.name)}</h3><p>${escapeHtml(folder.description || 'Thư mục ảnh và video minh chứng tại điểm khảo sát.')}</p><div class="folder-card-bottom"><span>Xem thư mục</span><span aria-hidden="true">✦</span></div></a>`;
}
function renderDay(day) {
  const folders = allFolders(day.id);
  return `<div class="container detail-top">${breadcrumbs([{label:'Trang chủ',href:'#/'},{label:`Ngày ${day.number}`}])}
    ${headerForDetail(day, `Ngày ${day.number}: ${day.title}`, day.summary)}
    </div><section class="container detail-body"><div class="detail-heading"><div><h2>Thư mục điểm khảo sát</h2><p>${folders.length} địa điểm · ${dayMediaCount(day.id)} ảnh/video</p></div>${state.editing ? `<button type="button" class="btn btn-primary btn-small" data-action="new-folder" data-day="${day.id}">Tạo thư mục mới</button>` : ''}</div>
    ${folders.length ? `<div class="folder-grid">${folders.map((folder) => folderCard(folder, day)).join('')}${state.editing ? `<button class="folder-card add-folder" type="button" data-action="new-folder" data-day="${day.id}"><span class="plus">+</span><strong>Thêm địa điểm</strong><span>Tạo thư mục riêng cho điểm khảo sát khác</span></button>` : ''}</div>` : `<div class="empty-state"><div class="empty-icon">▤</div><h3>Chưa có thư mục nào</h3><p>${state.editing ? 'Tạo một thư mục để bắt đầu lưu giữ minh chứng.' : 'Nhóm đang chuẩn bị thư mục minh chứng cho ngày khảo sát này.'}</p>${state.editing ? `<button type="button" class="btn btn-primary" data-action="new-folder" data-day="${day.id}">Tạo thư mục đầu tiên</button>` : ''}</div>`}
    <div class="folder-footer-nav"><a class="btn btn-outline btn-small" href="#/">Về 8 ngày khảo sát</a>${state.catalog.days.find((x) => x.number === day.number + 1) ? `<a class="btn btn-ghost btn-small" href="${pathForHash(`ngay-${day.number + 1}`)}">Xem ngày tiếp theo</a>` : ''}</div>
  </section>`;
}

function mediaCard(item, day, folder) {
  const src = mediaSrc(item);
  const thumbnail = src ? (item.type === 'video'
    ? `<video src="${escapeHtml(src)}#t=0.1" muted preload="metadata" playsinline></video><span class="media-play">▶</span>`
    : `<img src="${escapeHtml(src)}" alt="${escapeHtml(item.title)}" loading="lazy"/>`)
    : '<span class="empty-icon" style="margin:auto">▧</span>';
  const when = [formDate(item.shotDate), item.shotTime].filter(Boolean).join(' · ');
  return `<article class="media-card"><button type="button" class="media-thumb" data-action="open-media" data-id="${escapeHtml(item.id)}" aria-label="Mở ${escapeHtml(item.title)}">${thumbnail}<span class="media-type">${item.type === 'video' ? '▶ Video' : '▣ Ảnh'}</span>${item.code ? `<span class="media-code-badge">${escapeHtml(item.code)}</span>` : ''}</button>
    <div class="media-card-copy"><span class="media-place">${escapeHtml(item.place || folder.name)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.caption || 'Minh chứng ghi nhận trong chuyến thực tế chuyên môn.')}</p><div class="media-meta">${escapeHtml([when, item.author].filter(Boolean).join(' · ') || 'Minh chứng khảo sát')}</div>${state.editing ? `<div class="media-card-actions"><button class="mini-action" type="button" data-action="edit-media" data-id="${escapeHtml(item.id)}">Sửa chú thích</button><button class="mini-action danger" type="button" data-action="delete-media" data-id="${escapeHtml(item.id)}">Xóa</button></div>` : ''}</div></article>`;
}
function renderFolder(day, folder) {
  const items = allMedia(folder.id);
  return `<div class="container detail-top">${breadcrumbs([{label:'Trang chủ',href:'#/'},{label:`Ngày ${day.number}`,href:pathForHash(day.id)},{label:folder.name}])}
    ${headerForDetail(day, folder.name, folder.description || 'Ảnh và video minh chứng tại điểm khảo sát.', `NGÀY ${day.number} · ${day.date} · ${items.length} MINH CHỨNG`)}
    ${state.editing ? `<div class="detail-actions" style="margin:15px 0 0"><button type="button" class="btn btn-ghost btn-small" data-action="edit-folder" data-id="${escapeHtml(folder.id)}">Sửa thư mục</button><button type="button" class="btn btn-outline btn-small" data-action="delete-folder" data-id="${escapeHtml(folder.id)}">Xóa thư mục</button></div>` : ''}</div>
    <section class="container detail-body"><div class="detail-heading"><div><h2>Ảnh và video minh họa</h2><p>${items.length ? 'Bấm vào một minh chứng để xem đầy đủ thông tin.' : 'Thư mục này hiện chưa có ảnh hoặc video.'}</p></div>${state.editing ? `<button type="button" class="btn btn-primary btn-small" data-action="upload" data-id="${escapeHtml(folder.id)}">Thêm ảnh / video</button>` : ''}</div>
    ${state.editing ? `<div class="upload-zone" data-drop-zone="${escapeHtml(folder.id)}"><div class="upload-icon">▧</div><h3>Thả ảnh hoặc video vào đây</h3><p>JPG, PNG, WEBP, GIF, AVIF, MP4, WEBM, MOV · Mỗi tệp không quá 95 MB · Nên dùng MP4 cho video.</p><button type="button" class="btn btn-outline btn-small" data-action="upload" data-id="${escapeHtml(folder.id)}">Chọn tệp từ máy</button></div>` : ''}
    ${items.length ? `<div class="media-grid">${items.map((item) => mediaCard(item, day, folder)).join('')}</div>` : `<div class="empty-state"><div class="empty-icon">📷</div><h3>Khoảnh khắc đang chờ được lưu giữ</h3><p>${state.editing ? 'Chọn ảnh/video có sẵn trên máy, điền tên và chú thích để hoàn thiện thư mục.' : 'Nhóm sẽ cập nhật hình ảnh và video tại điểm khảo sát này.'}</p>${state.editing ? `<button type="button" class="btn btn-primary" data-action="upload" data-id="${escapeHtml(folder.id)}">Thêm minh chứng đầu tiên</button>` : ''}</div>`}
    <div class="folder-footer-nav"><a class="btn btn-outline btn-small" href="${pathForHash(day.id)}">Về thư mục ngày ${day.number}</a><a class="btn btn-ghost btn-small" href="#/">Về trang chủ</a></div>
    </section>`;
}

function showViewer(media, folder) {
  const src = mediaSrc(media);
  if (!src) { toast('Không tìm thấy tệp gốc. Hãy kiểm tra lại thư mục media trên GitHub.'); return; }
  const when = [formDate(media.shotDate), media.shotTime].filter(Boolean).join(' · ');
  const coords = formattedCoordinates(media);
  const mapUrl = safeHref(media.mapUrl) || (coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '');
  const facts = [
    ['Địa điểm chụp', media.place || folder.name],
    ['Ngày khảo sát', surveyDayLabel(media.surveyDay || folder.dayId)],
    ['Ngày / giờ chụp', when],
    ['Người chụp / Nguồn ảnh', media.author],
    ['Tọa độ khảo sát', coords]
  ].filter((entry) => entry[1]);
  $('viewer-content').innerHTML = `<div class="viewer-media">${media.type === 'video'
    ? `<video src="${escapeHtml(src)}" controls playsinline preload="metadata"></video>`
    : `<img src="${escapeHtml(src)}" alt="${escapeHtml(media.title)}"/>`}</div>
    <div class="viewer-info"><div class="viewer-eyebrow">MINH CHỨNG THỰC ĐỊA · K49${media.code ? `<span class="viewer-code">${escapeHtml(media.code)}</span>` : ''}</div><h2>${escapeHtml(media.title)}</h2><p>${escapeHtml(media.caption || 'Minh chứng tại điểm khảo sát.')}</p>
    <div class="viewer-fact-grid">${facts.map(([label, value]) => `<div class="viewer-fact"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>
    <div class="viewer-links">${mapUrl ? `<a class="btn btn-outline btn-small" href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer">Xem trên Google Maps</a>` : ''}<button class="btn btn-ghost btn-small" type="button" data-viewer-copy="true">Sao chép liên kết minh chứng</button></div></div>`;
  const dialog = $('viewer-dialog');
  if (!dialog.open) dialog.showModal();
}

let renderVersion = 0;
async function render() {
  const version = ++renderVersion;
  await hydrateObjectUrls();
  if (version !== renderVersion) return;
  updateRibbon();
  const route = parseRoute();
  const day = state.catalog.days.find((x) => x.id === route.dayId);
  const folder = route.folderId && day ? state.catalog.folders.find((x) => x.id === route.folderId && x.dayId === day.id) : null;
  const app = $('app');
  app.innerHTML = !day ? renderHome() : folder ? renderFolder(day, folder) : renderDay(day);
  document.title = folder ? `${folder.name} | Dấu chân miền di sản` : day ? `Ngày ${day.number} | Dấu chân miền di sản` : 'Dấu chân miền di sản | Kho minh chứng';
  const dialog = $('viewer-dialog');
  if (folder && route.mediaId) {
    const item = state.catalog.media.find((x) => x.id === route.mediaId && x.folderId === folder.id);
    if (item) showViewer(item, folder);
    else if (dialog.open) dialog.close();
  } else if (dialog.open) dialog.close();
}

function requireEditing() {
  if (state.editing) return true;
  toast('Hãy bấm “Quản lý kho” để thêm hoặc chỉnh sửa nội dung.');
  return false;
}
function openFolderDialog(dayId, folderId = '') {
  if (!requireEditing()) return;
  const form = $('folder-form');
  form.reset();
  const folder = state.catalog.folders.find((x) => x.id === folderId);
  form.elements.folderId.value = folder?.id || '';
  form.elements.dayId.value = folder?.dayId || dayId;
  form.elements.name.value = folder?.name || '';
  form.elements.description.value = folder?.description || '';
  $('folder-dialog-title').textContent = folder ? 'Chỉnh sửa thư mục' : 'Tạo thư mục mới';
  $('folder-dialog').showModal();
  setTimeout(() => form.elements.name.focus(), 0);
}
function openMediaDialog(item, isNewUpload = false) {
  if (!requireEditing()) return;
  const form = $('media-form');
  form.reset();
  const folder = state.catalog.folders.find((entry) => entry.id === item.folderId);
  const dayId = item.surveyDay || folder?.dayId || '';
  const select = form.elements.surveyDay;
  select.innerHTML = `<option value="">Chọn ngày</option>${state.catalog.days.map((day) => `<option value="${escapeHtml(day.id)}">Ngày ${day.number} (${escapeHtml(day.date)})</option>`).join('')}`;
  for (const key of ['code', 'title', 'place', 'shotDate', 'shotTime', 'caption', 'author', 'latitude', 'longitude', 'mapUrl']) {
    form.elements[key].value = item[key] || '';
  }
  select.value = dayId;
  form.elements.mediaId.value = item.id;
  const src = mediaSrc(item);
  const preview = src ? (item.type === 'video'
    ? `<video src="${escapeHtml(src)}" muted playsinline preload="metadata"></video>`
    : `<img src="${escapeHtml(src)}" alt="Ảnh đang chỉnh sửa" />`)
    : `<div class="preview-fallback">▧</div>`;
  $('media-form-preview').innerHTML = `<div class="form-preview-visual">${preview}</div><div><span class="preview-chip">${item.type === 'video' ? 'VIDEO' : 'HÌNH ẢNH'}</span><strong>${escapeHtml(item.title)}</strong><small>Hãy bổ sung thông tin để bộ ảnh có chú thích rõ ràng, dễ tra cứu.</small></div>`;
  $('media-dialog-title').textContent = isNewUpload ? 'Bổ sung chú thích cho ảnh mới' : 'Chỉnh sửa thông tin ảnh / video';
  $('media-dialog-hint').textContent = isNewUpload ? 'Ảnh đã được lưu tạm. Điền thông tin bên dưới để hoàn thiện minh chứng.' : 'Thông tin này được hiển thị khi người xem mở ảnh hoặc video.';
  $('coordinate-panel').open = Boolean(item.latitude || item.longitude || item.mapUrl);
  $('media-dialog').showModal();
}
function openNextCaption() {
  while (state.captionQueue.length) {
    const id = state.captionQueue.shift();
    const item = state.catalog.media.find((entry) => entry.id === id);
    if (item) { openMediaDialog(item, true); return; }
  }
}
async function deleteFolder(folderId) {
  if (!requireEditing()) return;
  const folder = state.catalog.folders.find((x) => x.id === folderId);
  if (!folder) return;
  const media = allMedia(folderId);
  if (!confirm(`Xóa thư mục “${folder.name}” và ${media.length} minh chứng bên trong? Các tệp đã đăng GitHub cần được xóa thủ công nếu không còn sử dụng.`)) return;
  for (const item of media) if (item.blobKey) await removeFile(item.blobKey);
  state.catalog.media = state.catalog.media.filter((x) => x.folderId !== folderId);
  state.catalog.folders = state.catalog.folders.filter((x) => x.id !== folderId);
  location.hash = pathForHash(folder.dayId);
  await saveDraftAndRender();
  toast('Đã xóa thư mục trong bản nháp.');
}
async function deleteMedia(mediaId) {
  if (!requireEditing()) return;
  const item = state.catalog.media.find((x) => x.id === mediaId);
  if (!item || !confirm(`Xóa minh chứng “${item.title}” khỏi kho?`)) return;
  if (item.blobKey) await removeFile(item.blobKey);
  state.catalog.media = state.catalog.media.filter((x) => x.id !== mediaId);
  await saveDraftAndRender();
  toast('Đã xóa minh chứng trong bản nháp.');
}
async function addFiles(files, folderId) {
  if (!requireEditing()) return;
  const folder = state.catalog.folders.find((x) => x.id === folderId);
  if (!folder) return;
  const max = 95 * 1024 * 1024;
  let added = 0;
  const addedIds = [];
  const rejected = [];
  for (const file of Array.from(files)) {
    const type = mimeKind(file);
    if (!type) { rejected.push(`${file.name}: định dạng chưa hỗ trợ`); continue; }
    if (file.size > max) { rejected.push(`${file.name}: quá 95 MB`); continue; }
    const id = `media-${uid()}`;
    const blobKey = `file-${id}`;
    try { await storeFile(blobKey, file); }
    catch { rejected.push(`${file.name}: trình duyệt hết dung lượng lưu trữ`); continue; }
    const dot = file.name.lastIndexOf('.');
    const baseName = dot > 0 ? file.name.slice(0, dot) : file.name;
    const parsedCode = baseName.match(/^([A-Za-z]{2,}\d{2}-\d{2,})[-_ ]/);
    state.catalog.media.push({
      id, folderId, type, src: pathFor(folder.dayId, folderId, file), blobKey,
      code: parsedCode ? parsedCode[1].toUpperCase() : '',
      title: (parsedCode ? baseName.slice(parsedCode[0].length) : baseName).replace(/[_-]+/g, ' ').trim() || baseName,
      surveyDay: folder.dayId, caption: '', author: '', shotDate: '', shotTime: '',
      place: folder.name, latitude: '', longitude: '', mapUrl: ''
    });
    added += 1;
    addedIds.push(id);
  }
  if (added) {
    await saveDraftAndRender();
    state.captionQueue.push(...addedIds);
    openNextCaption();
    toast(`Đã lưu tạm ${added} ảnh/video. Bạn có thể điền chú thích ngay bây giờ.`);
  }
  if (rejected.length) alert(`Một số tệp chưa được thêm:\n\n${rejected.join('\n')}`);
}

function closeViewerRoute() {
  const route = parseRoute();
  if (route.mediaId) location.hash = pathForHash(route.dayId, route.folderId);
  else if ($('viewer-dialog').open) $('viewer-dialog').close();
}
async function copyCurrentLink() {
  if (location.protocol === 'file:') { toast('Hãy đăng lên GitHub Pages rồi mới chia sẻ liên kết công khai.'); return; }
  try { await navigator.clipboard.writeText(location.href); toast('Đã sao chép liên kết!'); }
  catch { window.prompt('Sao chép liên kết này:', location.href); }
}
function showQr() {
  if (location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname)) {
    toast('Hãy đăng web lên GitHub Pages trước khi tạo QR công khai.'); return;
  }
  $('qr-link').value = location.href;
  $('qr-image').src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(location.href)}`;
  $('qr-description').textContent = 'Dùng camera để quét QR. Dịch vụ tạo QR chỉ nhận liên kết công khai của trang này.';
  $('qr-dialog').showModal();
}

async function exportUpdate() {
  if (state.exportBusy) return;
  state.exportBusy = true;
  const button = $('export-button');
  button.disabled = true;
  const label = button.textContent;
  button.textContent = 'Đang chuẩn bị ZIP...';
  try {
    // Bỏ blobKey vì khóa này chỉ có ý nghĩa trong trình duyệt của người quản lý.
    const manifest = structuredClone(state.catalog);
    manifest.media = manifest.media.map(({ blobKey, ...item }) => item);
    const content = `/* Tệp danh mục được xuất tự động bởi kho minh chứng. */\nwindow.PUBLISHED_CATALOG = ${JSON.stringify(manifest, null, 2)};\n`;
    const guide = `CẬP NHẬT KHO MINH CHỨNG - GITHUB PAGES\n\n1. Giải nén file ZIP này.\n2. Sao chép TẤT CẢ nội dung vừa giải nén vào THƯ MỤC GỐC của mã nguồn website trong máy (giữ cấu trúc data/ và media/).\n3. Chọn ghi đè data/catalog.js; chỉ BỔ SUNG các tệp mới trong media/, KHÔNG xóa các ảnh/video cũ.\n4. Commit và push các thay đổi lên nhánh dùng cho GitHub Pages.\n5. Đợi GitHub Pages cập nhật, mở trang trong cửa sổ ẩn danh để kiểm tra.\n\nLƯU Ý:\n- Chỉ data/catalog.js và các tệp media mới được đóng gói; mã nguồn giao diện không nằm trong gói cập nhật.\n- Ảnh/video xóa khỏi danh mục sẽ không xuất hiện trên web, nhưng tệp cũ trên GitHub phải xóa thủ công nếu muốn dọn kho.\n- Nếu làm chung nhiều máy, hãy thống nhất một máy quản lý để tránh ghi đè danh mục.\n- File video .mov có thể không xem được trên một số trình duyệt; nên dùng .mp4 (H.264).\n`;
    const files = [
      { name: 'data/catalog.js', blob: new Blob([content], { type: 'text/javascript' }) },
      { name: 'HUONG_DAN_CAP_NHAT.txt', blob: new Blob([guide], { type: 'text/plain;charset=utf-8' }) }
    ];
    for (const item of state.catalog.media) {
      if (!item.blobKey) continue;
      const blob = await readFile(item.blobKey);
      if (!blob) throw new Error(`Không tìm thấy tệp của “${item.title}” trên thiết bị này. Không thể xuất bản cập nhật hoàn chỉnh.`);
      files.push({ name: item.src, blob });
    }
    const zip = await buildZip(files, (done, total) => { button.textContent = `Đang đóng gói ${done}/${total}...`; });
    const d = new Date();
    const suffix = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    downloadBlob(zip, `CAP_NHAT_KHO_MINH_CHUNG_${suffix}.zip`);
    toast(`Đã tạo ZIP với ${files.length - 2} tệp ảnh/video mới. Hãy đưa lên GitHub để công khai.`);
  } catch (error) {
    console.error(error);
    alert(`Không thể xuất gói cập nhật: ${error.message || error}`);
  } finally {
    state.exportBusy = false;
    button.textContent = label;
    button.disabled = false;
  }
}

function bindEvents() {
  $('manage-button').addEventListener('click', async () => {
    state.editing = !state.editing;
    await render();
    if (state.editing) toast('Đã bật chế độ quản lý. Mọi thay đổi chỉ lưu trong trình duyệt này.');
  });
  $('help-button').addEventListener('click', () => $('help-dialog').showModal());
  $('export-button').addEventListener('click', exportUpdate);
  $('discard-button').addEventListener('click', async () => {
    if (!confirm('Bỏ toàn bộ bản nháp trên máy này? Ảnh/video CHƯA xuất lên GitHub sẽ bị xóa khỏi trình duyệt.')) return;
    await clearEverything();
    for (const url of state.objectUrls.values()) URL.revokeObjectURL(url);
    state.objectUrls.clear();
    state.catalog = structuredClone(initial);
    state.hasDraft = false;
    state.editing = false;
    location.hash = '#/';
    await render();
    toast('Đã khôi phục bản danh mục đang xuất bản.');
  });
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => {
    const target = button.dataset.close;
    $(target).close();
    if (target === 'media-dialog' && state.captionQueue.length) openNextCaption();
  }));
  $('viewer-close').addEventListener('click', closeViewerRoute);
  $('viewer-dialog').addEventListener('close', () => { if (parseRoute().mediaId) closeViewerRoute(); });
  $('viewer-content').addEventListener('click', (event) => { if (event.target.closest('[data-viewer-copy]')) copyCurrentLink(); });
  $('copy-qr-link').addEventListener('click', copyCurrentLink);
  window.addEventListener('hashchange', () => { render(); window.scrollTo({ top: 0, behavior: 'instant' }); });

  $('folder-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const id = form.elements.folderId.value;
    const dayId = form.elements.dayId.value;
    const name = form.elements.name.value.trim();
    const description = form.elements.description.value.trim();
    if (!name) return;
    const duplicate = state.catalog.folders.find((f) => f.dayId === dayId && f.name.toLowerCase() === name.toLowerCase() && f.id !== id);
    if (duplicate) { toast('Ngày này đã có một thư mục cùng tên.'); return; }
    const old = state.catalog.folders.find((f) => f.id === id);
    if (old) { old.name = name; old.description = description; }
    else state.catalog.folders.push({ id: `${slugify(name)}-${uid().slice(0, 5)}`, dayId, name, description });
    $('folder-dialog').close();
    await saveDraftAndRender();
    toast('Đã lưu thư mục.');
  });
  $('media-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const item = state.catalog.media.find((m) => m.id === form.elements.mediaId.value);
    if (!item) return;
    const mapUrl = form.elements.mapUrl.value.trim();
    if (mapUrl && !safeHref(mapUrl)) { toast('Liên kết bản đồ chưa hợp lệ.'); return; }
    const latitude = form.elements.latitude.value.trim();
    const longitude = form.elements.longitude.value.trim();
    if (Boolean(latitude) !== Boolean(longitude)) {
      toast('Nếu thêm tọa độ, bạn cần nhập cả vĩ độ và kinh độ.');
      $('coordinate-panel').open = true;
      return;
    }
    const code = form.elements.code.value.trim().toUpperCase();
    const duplicate = code && state.catalog.media.some((entry) => entry.id !== item.id && String(entry.code || '').toUpperCase() === code);
    if (duplicate) { toast('Mã ảnh này đã được sử dụng. Hãy nhập mã khác.'); return; }
    const requestedDay = form.elements.surveyDay.value;
    if (requestedDay && !state.catalog.days.some((entry) => entry.id === requestedDay)) {
      toast('Ngày khảo sát chưa hợp lệ.'); return;
    }
    for (const key of ['code', 'surveyDay', 'title', 'place', 'shotDate', 'shotTime', 'author', 'caption', 'latitude', 'longitude', 'mapUrl']) {
      item[key] = form.elements[key].value.trim();
    }
    item.code = code;
    $('media-dialog').close();
    await saveDraftAndRender();
    toast('Đã lưu chú thích minh chứng.');
    if (state.captionQueue.length) openNextCaption();
  });
  $('media-file-picker').addEventListener('change', async (event) => {
    const files = Array.from(event.target.files);
    event.target.value = '';
    if (files.length && state.fileTargetFolder) await addFiles(files, state.fileTargetFolder);
  });

  $('app').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action, day, id } = button.dataset;
    switch (action) {
      case 'scroll-days': $('hanh-trinh')?.scrollIntoView({ behavior: 'smooth' }); break;
      case 'help': $('help-dialog').showModal(); break;
      case 'copy-link': await copyCurrentLink(); break;
      case 'qr': showQr(); break;
      case 'new-folder': openFolderDialog(day); break;
      case 'edit-folder': openFolderDialog('', id); break;
      case 'delete-folder': await deleteFolder(id); break;
      case 'upload':
        if (requireEditing()) { state.fileTargetFolder = id; $('media-file-picker').click(); }
        break;
      case 'edit-media': {
        const item = state.catalog.media.find((m) => m.id === id);
        if (item) openMediaDialog(item);
        break;
      }
      case 'delete-media': await deleteMedia(id); break;
      case 'open-media': {
        const route = parseRoute();
        location.hash = pathForHash(route.dayId, route.folderId, id);
        break;
      }
    }
  });

  $('app').addEventListener('dragover', (event) => {
    const zone = event.target.closest('[data-drop-zone]');
    if (!zone || !state.editing) return;
    event.preventDefault();
    zone.classList.add('dragging');
  });
  $('app').addEventListener('dragleave', (event) => {
    const zone = event.target.closest('[data-drop-zone]');
    if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove('dragging');
  });
  $('app').addEventListener('drop', async (event) => {
    const zone = event.target.closest('[data-drop-zone]');
    if (!zone || !state.editing) return;
    event.preventDefault();
    zone.classList.remove('dragging');
    await addFiles(event.dataTransfer.files, zone.dataset.dropZone);
  });
}

async function initialize() {
  bindEvents();
  try {
    const draft = await readDraft();
    if (draft && Array.isArray(draft.days) && Array.isArray(draft.folders) && Array.isArray(draft.media)) {
      state.catalog = draft;
      state.hasDraft = true;
      state.editing = true;
    }
  } catch (error) {
    console.warn('Không thể đọc bản nháp:', error);
    toast('Không thể mở bộ nhớ nháp trên trình duyệt. Hãy kiểm tra chế độ riêng tư.');
  }
  await render();
}

initialize().catch((error) => {
  console.error(error);
  $('app').textContent = `Không thể mở kho minh chứng: ${error.message || error}`;
});
