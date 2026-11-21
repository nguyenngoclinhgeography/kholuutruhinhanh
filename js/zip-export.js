/*
  ZIP writer tối giản, không cần CDN hoặc thư viện ngoài.
  Dùng phương thức STORE (không nén) để giữ nguyên chất lượng ảnh/video.
  Tính CRC32 theo luồng; ảnh/video lớn không cần đọc hết vào một ArrayBuffer.
*/
const encoder = new TextEncoder();
const table = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  table[n] = c >>> 0;
}

async function getCrc32(blob) {
  const reader = blob.stream().getReader();
  let crc = 0xffffffff;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    for (let i = 0; i < value.length; i += 1) crc = table[(crc ^ value[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.min(2107, Math.max(1980, date.getFullYear()));
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  };
}

function zipHeader(nameBytes, blobSize, checksum, now) {
  const data = new Uint8Array(30 + nameBytes.length);
  const v = new DataView(data.buffer);
  const dt = dosDateTime(now);
  v.setUint32(0, 0x04034b50, true);
  v.setUint16(4, 20, true);
  v.setUint16(6, 0x0800, true); // tên tệp UTF-8
  v.setUint16(8, 0, true);      // STORE
  v.setUint16(10, dt.time, true);
  v.setUint16(12, dt.date, true);
  v.setUint32(14, checksum, true);
  v.setUint32(18, blobSize, true);
  v.setUint32(22, blobSize, true);
  v.setUint16(26, nameBytes.length, true);
  v.setUint16(28, 0, true);
  data.set(nameBytes, 30);
  return data;
}

function centralHeader(nameBytes, blobSize, checksum, localOffset, now) {
  const data = new Uint8Array(46 + nameBytes.length);
  const v = new DataView(data.buffer);
  const dt = dosDateTime(now);
  v.setUint32(0, 0x02014b50, true);
  v.setUint16(4, 20, true);
  v.setUint16(6, 20, true);
  v.setUint16(8, 0x0800, true);
  v.setUint16(10, 0, true);
  v.setUint16(12, dt.time, true);
  v.setUint16(14, dt.date, true);
  v.setUint32(16, checksum, true);
  v.setUint32(20, blobSize, true);
  v.setUint32(24, blobSize, true);
  v.setUint16(28, nameBytes.length, true);
  v.setUint16(30, 0, true);
  v.setUint16(32, 0, true);
  v.setUint16(34, 0, true);
  v.setUint16(36, 0, true);
  v.setUint32(38, 0, true);
  v.setUint32(42, localOffset, true);
  data.set(nameBytes, 46);
  return data;
}

async function buildZip(entries, onProgress = () => {}) {
  if (entries.length > 65535) throw new Error('Gói ZIP chứa quá nhiều tệp.');
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  let centralBytes = 0;
  const now = new Date();

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const name = String(entry.name).replaceAll('\\', '/').replace(/^\/+/, '');
    if (!name || name.includes('..') || name.startsWith('/')) throw new Error('Tên tệp không hợp lệ.');
    const nameBytes = encoder.encode(name);
    const blob = entry.blob instanceof Blob ? entry.blob : new Blob([entry.blob]);
    if (blob.size >= 0xffffffff || nameBytes.length > 65535) throw new Error('Một tệp quá lớn cho định dạng ZIP này.');
    const checksum = await getCrc32(blob);
    const header = zipHeader(nameBytes, blob.size, checksum, now);
    const central = centralHeader(nameBytes, blob.size, checksum, offset, now);
    localParts.push(header, blob);
    centralParts.push(central);
    offset += header.byteLength + blob.size;
    centralBytes += central.byteLength;
    if (offset > 0xffffffff || centralBytes > 0xffffffff) throw new Error('Dung lượng ZIP quá lớn. Hãy xuất thành các đợt nhỏ hơn.');
    onProgress(index + 1, entries.length);
  }

  const end = new Uint8Array(22);
  const v = new DataView(end.buffer);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(4, 0, true);
  v.setUint16(6, 0, true);
  v.setUint16(8, entries.length, true);
  v.setUint16(10, entries.length, true);
  v.setUint32(12, centralBytes, true);
  v.setUint32(16, offset, true);
  v.setUint16(20, 0, true);
  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
