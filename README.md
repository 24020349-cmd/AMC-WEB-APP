# AMC Web Application (Auto Multiple Choice Web App)

Hệ thống web quản lý, biên soạn đề thi trắc nghiệm, chấm thi tự động và phân tích bài thi dựa trên nền tảng Auto Multiple Choice (AMC).

## 📁 Cấu trúc thư mục

- `frontend/`: Ứng dụng giao diện người dùng viết bằng React + TypeScript + Vite + TailwindCSS.
- `backend/`: API dịch vụ và logic điều khiển AMC viết bằng Python (FastAPI / Uvicorn).
- `MC-Projects/`: Thư mục lưu trữ các bài thi và dự án làm việc của người dùng.
- `models/`: Chứa các template mẫu (.tex, .txt) cho việc tạo đề thi.
- `LLM_CV_Models/`: Các mô hình Computer Vision (YOLO) và xử lý hình ảnh hỗ trợ nhận dạng.
- `docker-compose.yml`: Cấu hình Docker compose cho toàn bộ hệ thống.

## 🚀 Hướng dẫn khởi chạy

### Chạy bằng Docker Compose (Khuyên dùng)

Yêu cầu máy tính đã cài đặt [Docker Desktop](https://www.docker.com/).

1. **Sao chép file cấu hình mẫu (nếu cần tùy chỉnh):**
   ```bash
   cp backend/app_settings.example.json backend/app_settings.json
   ```

2. **Khởi chạy hệ thống:**
   ```bash
   docker compose up -d --build
   ```

3. **Truy cập ứng dụng:**
   - Giao diện người dùng (Frontend): `http://localhost:5173`
   - Tài liệu API (Swagger UI): `http://localhost:8000/docs`

### Chạy thủ công (Development)

- **Backend:**
  ```bash
  cd backend
  pip install -r requirements.txt
  uvicorn main:app --reload --host 0.0.0.0 --port 8000
  ```

- **Frontend:**
  ```bash
  cd frontend
  npm install
  npm run dev
  ```
