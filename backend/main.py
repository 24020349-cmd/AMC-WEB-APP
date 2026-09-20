from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routers import projects

app = FastAPI(title="AMC Web API", version="1.0.0")

# Cấu hình CORS để cho phép Frontend kết nối
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Trong thực tế nên giới hạn lại
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api/projects", tags=["projects"])

@app.get("/")
def read_root():
    return {"message": "AMC Backend API is running"}
