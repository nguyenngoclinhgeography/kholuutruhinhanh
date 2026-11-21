# DẤU CHÂN MIỀN DI SẢN — KHO MINH CHỨNG 8 NGÀY

Website tĩnh dùng trên **GitHub Pages**, phục vụ **Phụ lục 3 – Bộ ảnh và video minh họa các điểm khảo sát** của chuyến thực tế chuyên môn Lịch sử – Địa lí, ngày 13–20/09/2026.

## Có gì trong website?

- Trang chủ chia thành **8 thẻ “Ngày 1” đến “Ngày 8”**, có tên chặng, ngày tháng và số minh chứng; màu sắc từng thẻ hài hòa, dễ phân biệt.
- Mỗi ngày có các **thư mục địa điểm**, đã gợi ý sẵn 21 điểm khảo sát để nhóm sử dụng ngay.
- Có thể **thêm, đổi tên, xóa thư mục** và **thêm ảnh / video** trong từng thư mục.
- Mỗi minh chứng có mẫu chú thích chi tiết: **mã ảnh, ngày khảo sát, tên ảnh/video, địa điểm chụp, ngày và giờ chụp, người chụp/nguồn ảnh, mô tả ngắn, tọa độ khảo sát, liên kết Google Maps**. Chỉ tên và địa điểm là bắt buộc.
- Xem ảnh lớn và phát video ngay trên trang; có **liên kết trực tiếp** tới ngày, thư mục và từng minh chứng.
- Có nút **lấy mã QR** cho URL đã đăng công khai.
- Bản nháp được **lưu trong trình duyệt** trên thiết bị đang quản lý (IndexedDB).
- Có nút **Xuất gói cập nhật ZIP** để đăng các thay đổi lên GitHub.

## Cách bắt đầu với GitHub Pages

1. Tạo một **repository công khai** mới trên GitHub, ví dụ `KHO-MINH-CHUNG-8-NGAY`.
2. Giải nén **file ZIP mã nguồn** được gửi kèm. Đưa các file `index.html`, thư mục `css`, `js`, `data`, `assets` vào **thư mục gốc** của repository. Giữ nguyên cấu trúc thư mục.
3. Vào **Settings → Pages**; ở *Build and deployment*, chọn **Deploy from a branch**, chọn nhánh `main`, thư mục `/ (root)`, sau đó **Save**.
4. Khi GitHub Pages hiển thị liên kết, mở trang để xem 8 ngày và các thư mục địa điểm có sẵn.

> Không cần dùng máy chủ riêng, cơ sở dữ liệu đám mây hay mã đăng nhập để **xem** nội dung đã xuất bản.

## Cách thêm ảnh / video và đăng lên GitHub

1. Mở trang trên máy tính bạn dùng để quản lý.
2. Bấm **Quản lý kho** ở góc trên. Vào ngày cần cập nhật, chọn thư mục có sẵn hoặc bấm **Tạo thư mục mới**.
3. Trong thư mục, bấm **Thêm ảnh / video**. Bạn có thể chọn nhiều file hoặc kéo thả vào vùng tải lên.
4. **Sau khi chọn ảnh/video, hộp “Bổ sung chú thích” tự mở**. Điền các trường như mẫu (mã ảnh dạng `MC06-01` nếu có, tên ảnh, địa điểm, ngày và giờ chụp, tác giả, mô tả...). Mở mục **Thêm tọa độ khảo sát** nếu cần ghi vĩ độ, kinh độ hoặc liên kết Google Maps. Bấm **Lưu chú thích**. Nếu tải lên nhiều tệp cùng lúc, các hộp chú thích sẽ lần lượt mở. Có thể chọn **Để sau** rồi chỉnh bằng nút **Sửa chú thích** dưới mỗi ảnh.
5. Bấm **Xuất gói cập nhật** ở thanh thông báo màu xanh. Trình duyệt sẽ tải file `CAP_NHAT_KHO_MINH_CHUNG_YYYYMMDD.zip`.
6. **Giải nén** ZIP cập nhật. Sao chép hai phần sau vào repo của website:
   - `data/catalog.js` (**ghi đè** tệp cũ): danh sách ngày, thư mục và thông tin minh chứng mới.
   - `media/` (**trộn thêm** tệp mới): toàn bộ ảnh/video chưa đăng của bản nháp. **Không xóa media cũ** khi sao chép.
7. **Commit/push** những thay đổi lên GitHub. Sau khi GitHub Pages cập nhật, khách truy cập ở thiết bị khác sẽ nhìn thấy ảnh/video và chú thích mới.

### Khi nâng cấp giao diện từ bản ZIP cũ

Nếu website của nhóm **đã có ảnh/video công khai**, chỉ cần cập nhật mã giao diện (`index.html`, `css/styles.css`, `js/app.js` và các file mã nguồn khác nếu thay đổi). **Giữ nguyên `data/catalog.js` hiện có trên GitHub và toàn bộ thư mục `media/`**. Không dùng danh mục mặc định trong ZIP giao diện để ghi đè danh mục đang chứa ảnh. Thông tin ảnh đã lưu từ bản cũ vẫn xem được; có thể mở **Sửa chú thích** để bổ sung trường mới.

### Ví dụ gói cập nhật

```
CAP_NHAT_KHO_MINH_CHUNG_20261121.zip
├── data/
│   └── catalog.js          ← ghi đè bản cũ
├── media/
│   └── ngay-1/
│       └── thap-po-klong-garai/
│           ├── abc123-thap-chinh.jpg
│           └── def456-hinh-thap.mp4
└── HUONG_DAN_CAP_NHAT.txt
```

## Điều quan trọng về lưu trữ

**GitHub Pages chỉ phục vụ nội dung đã có trong repository.** Bấm “Lưu” trên web **không thể tự đẩy ảnh/video lên GitHub**. Vì vậy:

- Trước khi xuất ZIP và commit lên GitHub, các thay đổi **chỉ nằm trong trình duyệt trên chính thiết bị đó**. Nếu đổi máy hoặc xóa dữ liệu trình duyệt, bản nháp có thể mất.
- Nên dùng **một máy quản lý chính**. Nhiều người chỉnh riêng trên nhiều máy sẽ tạo ra nhiều bản nháp không tự đồng bộ; ZIP mới có thể ghi đè thông tin do người khác cập nhật.
- Sau khi đã commit bản cập nhật và kiểm tra trang công khai, bạn có thể bấm **Bỏ bản nháp** để lấy lại dữ liệu đã xuất bản. Hãy tải lại trang trước để chắc chắn `data/catalog.js` mới đã được trình duyệt nhận.
- **Xóa một ảnh trên web** sẽ bỏ ảnh khỏi danh mục sau khi xuất bản, nhưng tệp vật lý cũ vẫn tồn tại trong repository cho đến khi xóa thủ công trên GitHub.
- Nếu muốn nhiều thành viên **đăng ảnh trực tiếp và tự đồng bộ**, trang cần một dịch vụ lưu trữ / hệ thống đăng nhập và một máy chủ hoặc dịch vụ đám mây riêng. Bản này được xây theo yêu cầu **tĩnh, chạy GitHub Pages, dễ sử dụng và không cần trả phí**.

## Mẹo chuẩn bị minh chứng

- Bạn có thể dùng ảnh đã xuất từ trang **TLTTCM2** (ảnh có thông tin in trên ảnh) rồi tải thẳng vào kho này.
- Tên ảnh nên rõ nội dung, ví dụ: `Tháp chính Po Klong Garai`, `Ngư dân gỡ cá tại Làng Gò Cỏ`.
- Chú thích nên có **đối tượng – điều quan sát – ý nghĩa**; tránh chỉ viết `Ảnh 1` hoặc `Video 2`.
- Ảnh ưu tiên **JPG/PNG/WEBP**; video ưu tiên **MP4 (H.264)** vì chạy tốt trên nhiều điện thoại. MOV có thể không phát được trên một số trình duyệt.
- Giới hạn trình quản lý: **95 MB/tệp** vì GitHub không nhận tệp trên 100 MB theo cách commit thông thường. Để website tải nhanh, video nên được nén còn khoảng 5–30 MB/tệp khi có thể.
- Nếu ảnh/video có người xuất hiện rõ mặt, nhóm nên cân nhắc quyền riêng tư trước khi đăng công khai.

## Chia sẻ liên kết và QR

- Trong **mỗi ngày** và **mỗi thư mục**, bấm **Sao chép liên kết** hoặc **Lấy mã QR**.
- Khi đang mở một ảnh/video lớn, bấm **Sao chép liên kết minh chứng** để có URL dẫn thẳng đến ảnh/video đó.
- Mã QR được tạo theo yêu cầu bằng dịch vụ công khai `api.qrserver.com` từ **URL trang công khai**. Nếu dùng ngoại tuyến, QR sẽ không tải được nhưng tính năng sao chép liên kết vẫn có thể dùng sau khi trang được đăng.
- Không chia sẻ liên kết khi đang mở web từ `file://` trên máy; hãy chia sẻ URL GitHub Pages.

## Cấu trúc file

```
index.html              Giao diện chính, các hộp thoại
css/styles.css          Toàn bộ kiểu dáng, hỗ trợ di động
js/app.js               8 ngày, thư mục, ảnh/video, chú thích, QR
js/storage.js           Lưu bản nháp trong trình duyệt
js/zip-export.js        Xuất ZIP không cần thư viện ngoài
data/catalog.js         Danh mục công khai (21 thư mục gợi ý)
assets/favicon.svg      Biểu tượng trang web
README.md               Hướng dẫn đang đọc
```

**Chỉnh tên website:** sửa các đoạn chữ trong `index.html` và tiêu đề trong `js/app.js` nếu muốn đổi thương hiệu. **Chỉnh tên các ngày mặc định:** sửa `days` trong `data/catalog.js`. **Đổi tên, bổ sung hoặc xóa địa điểm:** bật chế độ Quản lý và chỉnh trực tiếp trong thư mục của từng ngày.

## Mở xem trên máy trước khi đưa lên GitHub

**Bạn có thể bấm đúp vào `index.html` để xem trang trực tiếp** trên Chrome hoặc Microsoft Edge sau khi giải nén ZIP, không cần cài phần mềm hay dùng GitHub trước. Bản này sử dụng JavaScript thông thường, không còn phụ thuộc vào ES Modules vốn có thể bị trình duyệt chặn khi mở từ `file://`. Nếu trình duyệt không cho lưu bản nháp khi mở từ ổ đĩa, hãy xem bằng tiện ích **Live Server** trong VS Code hoặc đưa lên **GitHub Pages** để dùng đầy đủ chức năng quản lý.

Với cấu hình GitHub Pages, đường dẫn đúng là:

```
https://TEN_TAI_KHOAN.github.io/TEN_REPOSITORY/
```

Trang không sử dụng cơ sở dữ liệu riêng hay thu thập thông tin người xem.
