# Google Sans dùng trong DutyRoster

Nguồn chính thức: https://github.com/googlefonts/googlesans và https://github.com/google/fonts/tree/main/ofl/googlesans.

- Family: **Google Sans**, biến thiên weight 400–700, normal và italic.
- Subset: latin, latin-ext và vietnamese; hỗ trợ chữ tiếng Việt và dấu tổ hợp.
- Tải từ Google Fonts CSS API ngày 26/09/2026, bản CSS `googlesans/v70`. Các URL nguồn nguyên bản lưu trong `backups/google-sans-source.css` trên máy triển khai này.
- Sáu file WOFF2 được lưu cùng project, tổng khoảng 132 KiB. Browser chỉ tải những subset/style cần dùng; không gọi Google Fonts lúc chạy.
- `google-sans.css` được đăng ký trong `angular.json`, Angular đóng gói font với đường dẫn phù hợp khi build. `styles.scss` đặt font cho HTML, body, Tailwind và các thành phần kế thừa. Bản mẫu HTML nạp stylesheet từ assets cùng ứng dụng.
- Giấy phép **SIL Open Font License 1.1** đi kèm trong `OFL.txt`. Bản chữ đậm dùng weight biến thiên, không cần thêm file riêng.

Kiểm tra: mở Network lọc `woff2`, các request phải trả 200 từ domain ứng dụng. Trong DevTools, body/menu/input phải nhận family Google Sans; thử chuỗi “Cục H04 · Nguyễn Văn Đặng · Giấy đi đường”.
