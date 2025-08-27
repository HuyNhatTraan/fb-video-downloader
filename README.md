# Facebook Video Downloader Extension

Extension Chrome để tải video Facebook dễ dàng với giao diện đẹp và tính năng đầy đủ.

## 🌟 Tính năng

- ✅ Tải video Facebook chỉ với 1 click
- ✅ Giao diện popup hiện đại với hiệu ứng glassmorphism  
- ✅ Preview video trước khi tải
- ✅ Lưu trữ video trong local storage
- ✅ Quản lý danh sách video (xóa từng video hoặc xóa tất cả)
- ✅ Tự động chuyển đổi link thành mobile version
- ✅ Giả User-Agent để truy cập mobile Facebook
- ✅ Tìm kiếm video thông qua Network monitoring

## 📁 Cấu trúc file

```
facebook-video-downloader/
├── manifest.json          # Cấu hình extension
├── popup.html             # Giao diện popup
├── popup.js               # Logic popup
├── background.js          # Service worker
├── content.js             # Content script
├── injected.js            # Script inject vào trang web
└── README.md              # Hướng dẫn
```

## 🚀 Cách cài đặt

1. **Tải source code:**
   - Tạo thư mục mới cho extension
   - Copy tất cả các file vào thư mục đó

2. **Load extension vào Chrome:**
   - Mở Chrome và vào `chrome://extensions/`
   - Bật "Developer mode" ở góc phải trên
   - Nếu bạn giải nén file: 
     - Click "Load unpacked"
     - Chọn thư mục chứa extension
   - Nếu không giải nén thì kéo file .zip vào là được hen 

3. **Pin extension:**
   - Click vào icon puzzle ở thanh công cụ
   - Pin "Facebook Video Downloader"

## 💡 Cách sử dụng

1. **Tìm video hoàn toàn tự động:**
   - Click vào icon extension
   - Dán link video Facebook vào ô input
   - Click "Tìm Video"
   - Extension tự động mở tab ẩn và tìm video
   - Không cần mở DevTools hay làm gì thêm

2. **Tải video:**
   - Xem preview video trong popup
   - Click "Tải về" để download
   - Video sẽ được tải về máy
   - Hoặc di chuột vào video ấn 3 chấm và tải về

3. **Quản lý video:**
   - Xem tất cả video đã lưu
   - Xóa từng video không cần
   - Xóa tất cả video cùng lúc

## ⚙️ Cách hoạt động

### 1. Hoạt động tự động trong background
- Extension hoạt động hoàn toàn tự động, không cần user mở DevTools
- Tự động tạo tab background để tìm video
- Background script monitor tất cả network requests
- Tự động đóng tab sau khi tìm xong

### 2. User Agent Spoofing
Extension sử dụng `declarativeNetRequest` để thay đổi User-Agent:
```
Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36
```

### 3. URL Conversion
- Chuyển đổi `facebook.com` → `m.facebook.com`
- Facebook tự động redirect về bản dành cho Mobile
- Mobile version dễ extract video hơn

### 4. Multi-layer Video Detection
Extension tìm video theo 4 phương pháp song song:
1. **Background webRequest**: Monitor tất cả requests tới fbcdn.net
2. **Injected script**: Override XMLHttpRequest và fetch trong page
3. **Content script**: Tìm video elements trong DOM
4. **MutationObserver**: Monitor DOM changes real-time

### 5. Background Processing
- Tạo tab ẩn để không ảnh hưởng trải nghiệm user
- Background script lưu trữ video URLs theo tab ID
- Promise-based system để handle async video detection
- Tự động cleanup khi tab đóng

### 6. Storage & Management
- Lưu video URLs trong `chrome.storage.local`
- Giới hạn 10 video gần nhất
- Mỗi video có: url, originalUrl, timestamp, id
- Real-time update UI khi có video mới

## 🛠️ Tính năng kỹ thuật

### Manifest V3
- Service Worker thay vì background page
- DeclarativeNetRequest API
- Chrome Storage API
- Content Scripts

### Network Monitoring
- WebRequest API để bắt media requests
- XMLHttpRequest/fetch override
- MutationObserver cho DOM changes

### UI/UX
- Modern glassmorphism design
- Loading states với spinner
- Success/error status messages
- Responsive video previews

## 🐛 Troubleshooting

### Video không tìm thấy
- Thử refresh trang Facebook
- Kiểm tra link có hợp lệ không
- Một số video private có thể không tải được

### Extension không hoạt động
- Kiểm tra permissions trong manifest
- Reload extension trong chrome://extensions/
- Kiểm tra Console errors

### Video không tải được
- Kiểm tra popup blocker
- Thử click chuột phải → "Save as"
- Một số video có thể bị Facebook bảo vệ

## 📝 Lưu ý

- Extension chỉ hoạt động với video public
- Không hỗ trợ Facebook Stories
- Tuân thủ Terms of Service của Facebook
- Chỉ dùng cho mục đích cá nhân

## 🔒 Bảo mật

- Không thu thập dữ liệu người dùng
- Chỉ truy cập Facebook domains
- Video URLs lưu local trên máy
- Không gửi data ra server ngoài

## 📞 Hỗ trợ

Nếu gặp vấn đề:
1. Kiểm tra Console trong DevTools
2. Kiểm tra Network tab khi tải video
3. Thử disable/enable lại extension
4. Clear storage và thử lại

## 🔄 Cập nhật

Version hiện tại: 1.0
- [x] Core functionality
- [x] Modern UI
- [ ] Batch download
- [ ] Video quality selection
- [ ] Subtitle download
