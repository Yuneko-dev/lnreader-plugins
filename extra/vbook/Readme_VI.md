# LNReader - VBook Extension Converter

**VBook Extension Converter** là một bộ công cụ mạnh mẽ được thiết kế để tự động hoá việc chuyển đổi các plugin (extension) từ định dạng của nền tảng **VBook** sang định dạng plugin TypeScript tương thích với hệ sinh thái của **LNReader** (`lnreader-plugins`).

Bộ công cụ này giúp các nhà phát triển tận dụng kho plugin khổng lồ sẵn có của cộng đồng VBook mà không cần phải viết lại mã nguồn từ đầu.

---

## 🚀 Tính Năng Nổi Bật

1. **Biến đổi Cú pháp Tự động (AST Transformation)**
   Sử dụng Babel để phân tích và viết lại mã nguồn JavaScript của VBook. Trình chuyển đổi sẽ tự động nhận diện các hàm đồng bộ (synchronous) của VBook như `fetch()`, `doc.select()`, biến đổi chúng thành các hàm bất đồng bộ (`await`) và quản lý scope linh hoạt bằng cách chuyển `var` thành `let`.

2. **Giả lập Môi trường (Runtime Polyfill)**
   Cung cấp một môi trường thực thi giả lập (Sandbox/Polyfill) hoàn chỉnh bên trong `plugin.ts`. Môi trường này cung cấp các đối tượng toàn cục mà script VBook thường gọi:
   - `fetch` -> `vbookFetch` (Xử lý request, tự parse HTML bằng Cheerio).
   - `Response.success`, `Response.error` -> Định dạng `{ data, next }` của LNReader.
   - `Html.parse`, `DOMWrapper` -> Mô phỏng Jsoup/DOM parser của VBook.
   - `browser` -> Giả lập hoặc cung cấp Fallback cho các script cào dữ liệu ẩn.

3. **Máy ảo Phân tích Tĩnh (Static VM Evaluator)**
   Môi trường VBook yêu cầu tải động giao diện (tabs, thể loại) qua file `home.js`. Converter sử dụng `node:vm` để tạo một sandbox tĩnh, giúp đánh giá trước và trích xuất cấu trúc giao diện này trực tiếp trong quá trình Build thay vì trong Runtime.

4. **Hỗ trợ Đa Nền Tảng**
   Hỗ trợ chuyển đổi trơn tru cả plugin **Truyện Chữ (Novel)** lẫn plugin **Video/Phim**. Tự động sinh ra các đoạn mã Webview (`customJS`) để nhúng HLS Player hoặc Iframe nếu cần thiết cho video.

---

## 📂 Cấu Trúc Thư Mục

Dưới đây là kiến trúc kĩ thuật của thư mục `extra/vbook`:

```text
extra/vbook/
├── build.ts            # Điểm vào (Entry-point) CLI. Đọc plugin.json của Repo VBook và quét tất cả các plugin bên trong.
├── index.ts            # CLI rút gọn dùng để convert nhanh một plugin VBook cụ thể (không quét toàn bộ Repo).
├── converter.ts        # Chịu trách nhiệm đọc và gộp (bundle) các file mã nguồn của 1 plugin (config.js, home.js, detail.js, ...).
├── ast.ts              # Xử lý Cây cú pháp trừu tượng (Babel AST), tự động thêm 'async/await' và sửa cấu trúc vòng lặp.
├── evaluator.ts        # Chứa máy ảo (VM) tĩnh để phân tích 'home.js' và trích xuất mảng dữ liệu cấu hình giao diện.
├── handlers/           # Xử lý đặc thù cho từng loại plugin (novel.ts, video.ts).
└── templates/
    ├── plugin.ts       # Template gốc, chứa toàn bộ Polyfill (fetch, DOMWrapper, Response) để nhúng mã VBook vào.
    └── webview/        # Template JS dùng để nhúng vào Webview (Hỗ trợ trình xem video).
```

---

## 🛠 Hướng Dẫn Sử Dụng

Bạn có thể chạy trình chuyển đổi trực tiếp thông qua CLI:

### 1. Build Toàn bộ Repository VBook được clone từ Github
```bash
npx tsx extra/vbook/build.ts <đường_dẫn_đến_thư_mục_repo_vbook>
```

**Ví dụ:**
```bash
npx tsx extra/vbook/build.ts vbook-ext
```

- Trình chuyển đổi sẽ quét tệp `plugin.json` trong thư mục đích.
- Tự động giải nén `plugin.zip` (nếu mã nguồn chưa được giải nén).
- Tiến hành xử lý mã (AST, Polyfill).
- Xuất kết quả cuối cùng (thường là file `index.ts` và thư mục plugin mới) vào thư mục `plugins/multi/vbook_<tên_plugin>`.

### 2. Build Một Plugin Cụ Thể
Dùng khi bạn chỉ muốn test hoặc sửa lỗi một plugin duy nhất mà không cần phải chờ quét lại toàn bộ kho:

```bash
npx tsx extra/vbook/index.ts <đường_dẫn_tới_1_plugin>
```

**Ví dụ:**
```bash
npx tsx extra/vbook/index.ts vbook-ext/extensions/novel/zuminovel
```

*Sau khi chạy xong, bạn tiến hành gõ lệnh `npm run build:full` như bình thường để compile các plugin VBook này ra file `.js` cho LNReader.*

---

## ⚠️ Lưu Ý & Giới Hạn

1. **Mã hoá (Encrypted Plugins):**
   Các plugin VBook được cấu hình `metadata.encrypt: true` hoặc có mã nguồn bị làm rối/mã hóa ở mức độ bảo mật cao (obfuscated AES) sẽ **bị bỏ qua** do không thể phân tích cấu trúc AST.

2. **Cấu trúc Thư mục Github Actions:**
   Nếu bạn đẩy mã nguồn lên Git, hãy nhớ chỉ đẩy các plugin đã được build (bên trong `plugins/multi/vbook_*`). Trình biên dịch Github Actions (CI) **không** tự động chạy script `build.ts` của thư mục này, mà chỉ dịch mã TypeScript ra JavaScript.

3. **Các API nguyên bản của vBook:**
    Mặc dù rất cố gắng nhưng không thể triển khai toàn bộ API của vBook trong LNReader eXtended. Điều đó đồng nghĩa với việc khả năng một Plugin có thể chạy mượt mà trên ứng dụng không đạt tuyệt đối.

4. **Không hỗ trợ một số loại Plugin:**
    Do LNReader không có hệ thống plugin riêng lẻ (`tts`, `translate`, `video`, `novel`), ... mà chỉ có 1 loại `novel` duy nhất; đồng thời hành vi của `video` cũng giống như `novel` nên Converter này chỉ hỗ trợ `video` và `novel` (`manga` chưa được test, mà ai lại dùng app đọc truyện xem manga vậy ;-;)

## Credit
- Phần Converter và Readme được tạo bởi AI.
- Plugin được test bởi Ellie: [Repo vbook-ext](https://github.com/kychitoge/vbook-ext) đã test (Khoảng ~8/21 plugins có một chút vấn đề về hoạt động, các chức năng cơ bản OK)
