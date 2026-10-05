# Font giao diện DutyRoster

Font đang sử dụng là **Google Sans**, được lưu tại [google-sans](google-sans/README.md) và đăng ký trong `angular.json`. Có đủ dấu tiếng Việt, kiểu thường/nghiêng, weight 400–700; không cần gọi Google Fonts khi chạy ứng dụng.

Tài liệu Be Vietnam Pro bên dưới là hướng dẫn cũ; stylesheet này không còn được nạp.

## Be Vietnam Pro — hướng dẫn cũ

This directory should contain the Be Vietnam Pro font files in WOFF2 format for offline use.

## Required Files

Download and place these files in this directory:

- `BeVietnamPro-Regular.woff2` (weight 400)
- `BeVietnamPro-Medium.woff2` (weight 500)
- `BeVietnamPro-SemiBold.woff2` (weight 600)

## How to Obtain

### Method 1: Download from Google Fonts

1. Visit: https://fonts.google.com/specimen/Be+Vietnam+Pro
2. Click "Download family"
3. Extract the ZIP
4. Convert TTF files to WOFF2 using:
   - Online: https://cloudconvert.com/ttf-to-woff2
   - CLI: `woff2_compress font.ttf`

### Method 2: Clone from GitHub

```bash
git clone https://github.com/nicksrepo/BeVietnamPro.git
cd BeVietnamPro/fonts
# Convert TTF to WOFF2
for f in *.ttf; do woff2_compress "$f"; done
```

## Integration

Once font files are in place:

1. The `be-vietnam-pro.css` file already contains `@font-face` declarations
2. Global import is added to `src/styles.scss`
3. Build includes this directory: `angular.json` → assets configuration

## Verification

After adding font files:

```bash
ng build
# Check dist/duty-fe/assets/fonts/ for .woff2 files
npm start
# Verify font loads in DevTools Network tab (no googleapis.com requests)
```
