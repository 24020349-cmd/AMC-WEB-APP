import shutil
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Body
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from pydantic import BaseModel
import time
from typing import Optional, List
import re
import sqlite3
import fitz  # PyMuPDF
from project import AMCProject
import os
import base64
import csv
import subprocess
import io
import json
import zipfile
import tarfile
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
import datetime


router = APIRouter()

BASE_DIR = Path(__file__).parent.parent.parent.resolve()
APP_ROOT = BASE_DIR.parent
DEFAULT_PROJECTS_ROOT = BASE_DIR / "MC-Projects"
SETTINGS_PATH = BASE_DIR / "app_settings.json"
PROJECTS_ROOT = DEFAULT_PROJECTS_ROOT
MODELS_ROOT = BASE_DIR.parent / "models"

DEFAULT_SETTINGS = {
    "projects_directory": str(DEFAULT_PROJECTS_ROOT),
    "limit_mse": 3.0,
    "limit_sensitivity": 8.0,
    "capture_dpi": 300,
    "notify_preparation": False,
    "notify_data_capture": True,
    "notify_grading": True,
    "notify_annotation": True,
    "scan_bw_threshold": 0.60,
    "scan_ignore_red": True,
    "name_field_type": "image",
    "marks_size_max_increase": 0.20,
    "marks_size_max_decrease": 0.20,
    "default_darkness_threshold": 0.15,
    "default_upper_darkness_threshold": 1.00,
    "process_scans_with_three_corner_marks": True,
    "minimal_mark": 0.0,
    "maximal_mark": 20.0,
    "mark_grain": 0.5,
    "rounding_type": "rounding",
    "build_catalog": True,
    "build_individual_solution": True,
    "show_anonymization": False,
    "anonymous_id_model": "edddds",
    "header_annotations": "%(aID)",
    "email_sender": "",
    "email_cc": "",
    "email_bcc": "",
    "email_delay": 0.0,
    "email_smtp_host": "smtp.gmail.com",
    "email_smtp_port": 465,
    "email_smtp_ssl": "SSL",
    "email_smtp_user": "",
    "email_smtp_password": "",
    "df_subjectemail_email_subject": "Exam question",
    "df_subjectemail_email_text": "Please find enclosed your question sheet.\nRegards.",
    "df_annotatedemail_email_subject": "Exam result",
    "df_annotatedemail_email_text": "Please find enclosed your annotated completed answer sheet.\nRegards.",
}

def display_path(path: Path) -> str:
    if path.resolve() == DEFAULT_PROJECTS_ROOT.resolve():
        return "MC-Projects"
    try:
        return str(path.resolve().relative_to(APP_ROOT.resolve())).replace("\\", "/")
    except ValueError:
        return str(path.resolve())

def resolve_projects_directory(value: str | None) -> Path:
    if not value or not value.strip():
        return DEFAULT_PROJECTS_ROOT
    normalized = value.strip().replace("\\", "/").strip("/")
    if normalized in ("MC-Projects", "backend/MC-Projects", "app/backend/MC-Projects"):
        return DEFAULT_PROJECTS_ROOT.resolve()
    if os.name == 'nt' and normalized.startswith("app/"):
        return DEFAULT_PROJECTS_ROOT.resolve()
    candidate = Path(value.strip()).expanduser()
    if not candidate.is_absolute():
        candidate = APP_ROOT / candidate
    return candidate.resolve()

def load_settings() -> dict:
    settings = DEFAULT_SETTINGS.copy()
    if SETTINGS_PATH.exists():
        try:
            stored_settings = json.loads(SETTINGS_PATH.read_text(encoding='utf-8'))
            if isinstance(stored_settings, dict):
                settings.update(stored_settings)
        except Exception:
            pass
    raw_dir = settings.get('projects_directory', '')
    projects_root = resolve_projects_directory(raw_dir)
    if os.name != 'nt' and str(raw_dir).startswith('/app'):
        pass
    else:
        settings["projects_directory"] = str(projects_root)
    return settings

def save_settings(settings: dict):
    SETTINGS_PATH.write_text(json.dumps(settings, indent=2), encoding='utf-8')

def refresh_projects_root():
    global PROJECTS_ROOT
    PROJECTS_ROOT = Path(load_settings()["projects_directory"])
    PROJECTS_ROOT.mkdir(parents=True, exist_ok=True)

refresh_projects_root()

class PreferencesUpdate(BaseModel):
    projects_directory: Optional[str] = None
    limit_mse: Optional[float] = None
    limit_sensitivity: Optional[float] = None
    capture_dpi: Optional[int] = None
    notify_preparation: Optional[bool] = None
    notify_data_capture: Optional[bool] = None
    notify_grading: Optional[bool] = None
    notify_annotation: Optional[bool] = None
    scan_bw_threshold: Optional[float] = None
    scan_ignore_red: Optional[bool] = None
    name_field_type: Optional[str] = None
    marks_size_max_increase: Optional[float] = None
    marks_size_max_decrease: Optional[float] = None
    default_darkness_threshold: Optional[float] = None
    default_upper_darkness_threshold: Optional[float] = None
    process_scans_with_three_corner_marks: Optional[bool] = None
    minimal_mark: Optional[float] = None
    maximal_mark: Optional[float] = None
    rounding_type: Optional[str] = None
    build_catalog: Optional[bool] = None
    build_individual_solution: Optional[bool] = None
    measured_box_proportion: Optional[float] = None
    show_anonymization: Optional[bool] = None
    anonymous_id_model: Optional[str] = None
    header_annotations: Optional[str] = None
    email_sender: Optional[str] = None
    email_cc: Optional[str] = None
    email_bcc: Optional[str] = None
    email_delay: Optional[float] = None
    email_smtp_host: Optional[str] = None
    email_smtp_port: Optional[int] = None
    email_smtp_ssl: Optional[str] = None
    email_smtp_user: Optional[str] = None
    email_smtp_password: Optional[str] = None
    df_subjectemail_email_subject: Optional[str] = None
    df_subjectemail_email_text: Optional[str] = None
    df_annotatedemail_email_subject: Optional[str] = None
    df_annotatedemail_email_text: Optional[str] = None


def preferences_payload() -> dict:
    settings = load_settings()
    return {
        "latex_models_directory": "Models",
        "latex_models_path": str(MODELS_ROOT.resolve()),
        "projects_directory": display_path(PROJECTS_ROOT),
        "projects_directory_path": str(PROJECTS_ROOT.resolve()),
        "limit_mse": float(settings["limit_mse"]),
        "limit_sensitivity": float(settings["limit_sensitivity"]),
        "capture_dpi": int(settings["capture_dpi"]),
        "notify_preparation": bool(settings["notify_preparation"]),
        "notify_data_capture": bool(settings["notify_data_capture"]),
        "notify_grading": bool(settings["notify_grading"]),
        "notify_annotation": bool(settings["notify_annotation"]),
        "scan_bw_threshold": float(settings["scan_bw_threshold"]),
        "scan_ignore_red": bool(settings["scan_ignore_red"]),
        "name_field_type": str(settings["name_field_type"]),
        "marks_size_max_increase": float(settings["marks_size_max_increase"]),
        "marks_size_max_decrease": float(settings["marks_size_max_decrease"]),
        "default_darkness_threshold": float(settings["default_darkness_threshold"]),
        "default_upper_darkness_threshold": float(settings["default_upper_darkness_threshold"]),
        "process_scans_with_three_corner_marks": bool(settings["process_scans_with_three_corner_marks"]),
        "minimal_mark": float(settings["minimal_mark"]),
        "maximal_mark": float(settings["maximal_mark"]),
        "mark_grain": 0.5,
        "rounding_type": str(settings["rounding_type"]),
        "build_catalog": settings.get("build_catalog", True),
        "build_individual_solution": settings.get("build_individual_solution", True),
        "measured_box_proportion": float(settings.get("measured_box_proportion", 0.80)),
        "show_anonymization": bool(settings.get("show_anonymization", False)),
        "anonymous_id_model": str(settings.get("anonymous_id_model", "edddds")),
        "header_annotations": str(settings.get("header_annotations", "%(aID)")),
        "email_sender": str(settings.get("email_sender", "")),
        "email_cc": str(settings.get("email_cc", "")),
        "email_bcc": str(settings.get("email_bcc", "")),
        "email_delay": float(settings.get("email_delay", 0.0)),
        "email_smtp_host": str(settings.get("email_smtp_host", "smtp.gmail.com")),
        "email_smtp_port": int(settings.get("email_smtp_port", 465)),
        "email_smtp_ssl": str(settings.get("email_smtp_ssl", "SSL")),
        "email_smtp_user": str(settings.get("email_smtp_user", "")),
        "email_smtp_password": str(settings.get("email_smtp_password", "")),
        "df_subjectemail_email_subject": str(settings.get("df_subjectemail_email_subject", "Exam question")),
        "df_subjectemail_email_text": str(settings.get("df_subjectemail_email_text", "Please find enclosed your question sheet.\nRegards.")),
        "df_annotatedemail_email_subject": str(settings.get("df_annotatedemail_email_subject", "Exam result")),
        "df_annotatedemail_email_text": str(settings.get("df_annotatedemail_email_text", "Please find enclosed your annotated completed answer sheet.\nRegards.")),
    }

@router.get("/preferences")
def get_preferences():
    refresh_projects_root()
    return preferences_payload()

@router.put("/preferences")
def update_preferences(update: PreferencesUpdate):
    try:
        settings = load_settings()
        changes = update.dict(exclude_none=True)
        if "projects_directory" in changes:
            projects_root = resolve_projects_directory(changes["projects_directory"])
            projects_root.mkdir(parents=True, exist_ok=True)
            settings["projects_directory"] = str(projects_root)
        for field in (
            "limit_mse", "limit_sensitivity", "capture_dpi", "scan_bw_threshold",
            "marks_size_max_increase", "marks_size_max_decrease", "default_darkness_threshold",
            "default_upper_darkness_threshold", "minimal_mark", "maximal_mark", "measured_box_proportion"
        ):
            if field in changes:
                value = changes[field]
                if value <= 0:
                    raise HTTPException(status_code=422, detail=f"{field} must be greater than zero.")
                settings[field] = value
        for field in ("notify_preparation", "notify_data_capture", "notify_grading", "notify_annotation", "build_catalog", "build_individual_solution"):
            if field in changes:
                settings[field] = changes[field]
        for field in ("scan_ignore_red", "process_scans_with_three_corner_marks"):
            if field in changes:
                settings[field] = changes[field]
        if "name_field_type" in changes:
            field_type = str(changes["name_field_type"]).lower()
            if field_type not in ("image", "barcode", "none"):
                raise HTTPException(status_code=422, detail="name_field_type must be Image, Barcode, or None.")
            settings["name_field_type"] = field_type
        if float(settings["maximal_mark"]) <= float(settings["minimal_mark"]):
            raise HTTPException(status_code=422, detail="Maximal mark must be greater than minimal mark.")
        if "rounding_type" in changes:
            rounding_type = changes["rounding_type"].lower()
            if rounding_type not in ("rounding", "ceiling", "floor"):
                raise HTTPException(status_code=422, detail="rounding_type must be rounding, ceiling, or floor.")
            settings["rounding_type"] = rounding_type
        if "show_anonymization" in changes:
            settings["show_anonymization"] = bool(changes["show_anonymization"])
        if "anonymous_id_model" in changes:
            settings["anonymous_id_model"] = str(changes["anonymous_id_model"])
        if "header_annotations" in changes:
            settings["header_annotations"] = str(changes["header_annotations"])

        for field in (
            "email_sender", "email_cc", "email_bcc",
            "email_smtp_host", "email_smtp_user", "email_smtp_password",
            "df_subjectemail_email_subject", "df_subjectemail_email_text",
            "df_annotatedemail_email_subject", "df_annotatedemail_email_text"
        ):
            if field in changes:
                settings[field] = str(changes[field]) if changes[field] is not None else ""

        if "email_delay" in changes:
            try:
                settings["email_delay"] = max(0.0, float(changes["email_delay"]))
            except (ValueError, TypeError):
                pass

        if "email_smtp_port" in changes:
            try:
                settings["email_smtp_port"] = int(changes["email_smtp_port"])
            except (ValueError, TypeError):
                pass

        if "email_smtp_ssl" in changes:
            ssl_val = str(changes["email_smtp_ssl"]).strip()
            if ssl_val in ("None", "SSL", "STARTTLS"):
                settings["email_smtp_ssl"] = ssl_val

        save_settings(settings)
        refresh_projects_root()
        return {"message": "Preferences saved", **preferences_payload()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ProjectPreferencesUpdate(BaseModel):
    seuil: Optional[float] = None
    seuil_up: Optional[float] = None
    name_field_type: Optional[str] = None
    note_null: Optional[str] = None
    note_min: Optional[str] = None
    note_max: Optional[str] = None
    note_max_plafond: Optional[bool] = None
    note_grain: Optional[str] = None
    note_arrondi: Optional[str] = None
    verdict: Optional[str] = None
    annote_rtl: Optional[bool] = None
    annote_position: Optional[str] = None
    verdict_q: Optional[str] = None
    verdict_qc: Optional[str] = None
    nom_examen: Optional[str] = None
    code_examen: Optional[str] = None
    modele_regroupement: Optional[str] = None

@router.get("/{name}/preferences")
def get_project_preferences(name: str):
    project = get_amc_project(name)
    settings = load_settings()
    return project.get_project_preferences(global_defaults=settings)

@router.post("/{name}/preferences")
def update_project_preferences(name: str, update: ProjectPreferencesUpdate):
    project = get_amc_project(name)
    data = update.model_dump(exclude_unset=True)
    project.set_project_preferences(data)
    settings = load_settings()
    return {"message": "Project preferences saved", **project.get_project_preferences(global_defaults=settings)}

class TestEmailRequest(BaseModel):
    recipient: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_ssl: Optional[str] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    sender: Optional[str] = None

@router.post("/preferences/test_email")
def test_email_connection(req: TestEmailRequest):
    settings = load_settings()
    host = req.smtp_host or settings.get("email_smtp_host", "smtp.gmail.com")
    port = req.smtp_port or int(settings.get("email_smtp_port", 465))
    security = req.smtp_ssl or settings.get("email_smtp_ssl", "SSL")
    user = req.smtp_user if req.smtp_user is not None else settings.get("email_smtp_user", "")
    password = req.smtp_password if req.smtp_password is not None else settings.get("email_smtp_password", "")
    sender = req.sender or settings.get("email_sender", "") or user
    recipient = req.recipient or sender

    if not recipient:
        raise HTTPException(status_code=400, detail="Vui lòng nhập địa chỉ email người nhận test hoặc điền Sender email.")

    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    server = None
    try:
        if security == "SSL":
            server = smtplib.SMTP_SSL(host, port, timeout=12)
        else:
            server = smtplib.SMTP(host, port, timeout=12)
            if security == "STARTTLS":
                server.starttls()
        
        if user and password:
            server.login(user, password)
        
        msg = MIMEMultipart()
        msg['From'] = sender
        msg['To'] = recipient
        msg['Subject'] = "[AMC-WEB] Kiểm tra kết nối SMTP thành công"
        body = (
            "Xin chào,\n\n"
            "Đây là email kiểm tra được gửi tự động từ hệ thống AMC-WEB-APP.\n"
            "Nếu bạn nhận được email này, cấu hình gửi email SMTP của bạn đã hoạt động hoàn toàn chính xác!\n\n"
            f"Thông tin cấu hình thử nghiệm:\n"
            f"- SMTP Host: {host}\n"
            f"- SMTP Port: {port}\n"
            f"- SMTP Security: {security}\n"
            f"- Sender: {sender}\n\n"
            "Trân trọng,\nAMC-WEB Team."
        )
        msg.attach(MIMEText(body, 'plain', 'utf-8'))

        server.sendmail(sender, [recipient], msg.as_string())
        return {"success": True, "message": f"Kết nối SMTP thành công và đã gửi email thử nghiệm tới {recipient}!"}
    except smtplib.SMTPAuthenticationError as e:
        err_msg = e.smtp_error.decode('utf-8', errors='ignore') if isinstance(e.smtp_error, bytes) else str(e)
        raise HTTPException(status_code=400, detail=f"Lỗi xác thực SMTP (Sai tài khoản hoặc Mật khẩu ứng dụng App Password): {err_msg}")
    except smtplib.SMTPConnectError as e:
        raise HTTPException(status_code=400, detail=f"Không thể kết nối đến máy chủ {host}:{port}. Vui lòng kiểm tra lại Host và Port.")
    except TimeoutError:
        raise HTTPException(status_code=400, detail=f"Kết nối đến máy chủ {host}:{port} bị quá hạn (Timeout). Vui lòng kiểm tra mạng hoặc tường lửa.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi kết nối / gửi email SMTP: {str(e)}")
    finally:
        if server:
            try:
                server.quit()
            except Exception:
                pass

@router.post("/preferences/select_projects_directory")
def select_projects_directory():
    if os.name != 'nt':
        raise HTTPException(status_code=501, detail="Native folder selection requires the backend to run on Windows.")
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        selected = filedialog.askdirectory(initialdir=str(PROJECTS_ROOT), title="Select projects directory")
        root.destroy()
        if not selected:
            return preferences_payload()
        projects_root = resolve_projects_directory(selected)
        projects_root.mkdir(parents=True, exist_ok=True)
        settings = load_settings()
        settings["projects_directory"] = str(projects_root)
        save_settings(settings)
        refresh_projects_root()
        return preferences_payload()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ProjectCreate(BaseModel):
    name: str
    source_type: str  # 'empty', 'template', 'file'
    template_name: Optional[str] = None
    file_content: Optional[str] = None

@router.get("/")
def list_projects():
    try:
        projects = []
        for entry in os.scandir(PROJECTS_ROOT):
            if entry.is_dir():
                projects.append({
                    "name": entry.name,
                    "path": str(Path(entry.path).resolve())
                })
        return projects
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/templates")
def list_templates():
    """Lấy danh sách file mẫu trong thư mục models/"""
    try:
        templates = []
        if MODELS_ROOT.exists():
            for entry in os.scandir(MODELS_ROOT):
                if entry.is_file() and (entry.name.endswith('.tex') or entry.name.endswith('.txt')):
                    templates.append(entry.name)
        return templates
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def create_project(project: ProjectCreate):
    try:
        # Khởi tạo thư mục dự án AMC (và các DB sqlite)
        amc_proj = AMCProject(base_path=str(PROJECTS_ROOT), project_name=project.name)
        amc_proj.create()
        
        # Đường dẫn file tex đích trong project
        # Target extension depends on the template or file content, defaulting to .tex
        ext = ".tex"
        if project.source_type == 'template' and project.template_name:
            if project.template_name.endswith('.txt'):
                ext = ".txt"
        elif project.source_type == 'file' and project.file_content:
            # Assume .tex unless we add logic, but we could check the file extension if provided
            pass
            
        target_file = amc_proj.project_dir / f"{project.name}{ext}"
        
        if project.source_type == 'empty':
            with open(target_file, 'w', encoding='utf-8') as f:
                f.write(f"\\documentclass{{article}}\n\\begin{{document}}\n% Empty AMC project: {project.name}\n\\end{{document}}")
                
        elif project.source_type == 'template' and project.template_name:
            template_path = MODELS_ROOT / project.template_name
            if template_path.exists():
                import shutil
                shutil.copy2(template_path, target_file)
            else:
                raise Exception(f"Template {project.template_name} not found")
                
        elif project.source_type == 'file' and project.file_content is not None:
            with open(target_file, 'w', encoding='utf-8') as f:
                f.write(project.file_content)
                
        else:
            raise Exception("Invalid source_type or missing arguments")

            
        return {"message": f"Project '{project.name}' created successfully", "name": project.name}
        
    except FileExistsError:
        raise HTTPException(status_code=400, detail="Project already exists")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ExtractRequest(BaseModel):
    xml_content: str

class MarkRequest(BaseModel):
    update_scale: bool
    postcorrect_student: Optional[int] = None
    postcorrect_copy: Optional[int] = None
    postcorrect_set_multiple: Optional[bool] = None

def get_amc_project(name: str) -> AMCProject:
    project_dir = PROJECTS_ROOT / name
    if not project_dir.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    return AMCProject(base_path=str(PROJECTS_ROOT), project_name=name)

@router.delete("/{name}")
def delete_project(name: str):
    amc_proj = get_amc_project(name)
    try:
        amc_proj.delete()
        return {"message": f"Project '{name}' deleted successfully."}
    except PermissionError:
        raise HTTPException(status_code=400, detail="The current project is being opened, you cannot delete it!")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{name}/rename")
def rename_project(name: str, new_name: str = Body(...)):
    amc_proj = get_amc_project(name)
    try:
        amc_proj.rename(new_name)
        return {"message": f"Project renamed to '{new_name}'.", "new_name": new_name}
    except FileExistsError:
        raise HTTPException(status_code=400, detail=f"Project '{new_name}' already exists.")
    except PermissionError:
        raise HTTPException(status_code=400, detail="The current project is being opened, you cannot rename it!")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{name}/copy")
def copy_project(name: str, new_name: str = Body(...)):
    amc_proj = get_amc_project(name)
    try:
        amc_proj.copy(new_name)
        return {"message": f"Project cloned to '{new_name}'.", "new_name": new_name}
    except FileExistsError:
        raise HTTPException(status_code=400, detail=f"Project '{new_name}' already exists.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{name}/export")
def export_project(name: str):
    import tempfile
    amc_proj = get_amc_project(name)
    temp_dir = tempfile.mkdtemp()
    
    try:
        zip_path = amc_proj.export_zip(temp_dir)
        
        def cleanup_temp():
            shutil.rmtree(temp_dir, ignore_errors=True)
            
        return FileResponse(
            path=zip_path,
            media_type="application/zip",
            filename=f"{name}.zip",
            background=BackgroundTask(cleanup_temp)
        )
    except Exception as e:
        import tempfile
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))
        
class TemplateExportRequest(BaseModel):
    file_name: str
    short_name: str
    description: str
    included_files: List[str]

@router.post("/{name}/export_template")
def export_template_endpoint(name: str, payload: TemplateExportRequest):
    amc_proj = get_amc_project(name)
    try:
        # Export thẳng vào thư mục models/ (ngoài cùng của dự án)
        amc_proj.export_zip_template(
            dest_dir=str(MODELS_ROOT),
            file_name=payload.file_name,
            short_name=payload.short_name,
            description=payload.description,
            included_files=payload.included_files
        )
        return {"message": "Template exported successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CleanupRequest(BaseModel):
    zooms: bool = False
    layout_reports: bool = False
    annotated_pages: bool = False

@router.get("/{name}/cleanup_info")
def get_cleanup_info(name: str):
    try:
        amc_proj = get_amc_project(name)
        return amc_proj.get_cleanup_info()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{name}/cleanup")
def cleanup_project(name: str, payload: CleanupRequest):
    try:
        amc_proj = get_amc_project(name)
        amc_proj.cleanup(
            zooms=payload.zooms,
            layout_reports=payload.layout_reports,
            annotated_pages=payload.annotated_pages
        )
        return {"message": "Cleanup successful"}
    except PermissionError:
        raise HTTPException(status_code=400, detail="Thư mục đang được mở bởi ứng dụng khác, không thể dọn dẹp.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{name}/marking_status")
def get_marking_status(name: str):
    amc_proj = get_amc_project(name)
    db_path = amc_proj.data_dir / "scoring.sqlite"
    if not db_path.exists():
        return {"computed": False, "count": 0, "mean": None}
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*), AVG(mark) FROM scoring_mark")
        count, mean = cur.fetchone()
        conn.close()
        return {
            "computed": count > 0,
            "count": count,
            "mean": round(float(mean), 2) if mean is not None else None,
        }
    except Exception:
        return {"computed": False, "count": 0, "mean": None}

@router.get("/{name}/marks_table")
def get_marks_table(name: str):
    amc_proj = get_amc_project(name)
    return amc_proj.get_marks_table()

@router.get("/{name}/status")
def get_project_status(name: str):
    amc_proj = get_amc_project(name)
    sujet_path = amc_proj.project_dir / "DOC-sujet.pdf"
    layout_path = amc_proj.data_dir / "layout.sqlite"

    pages = 0
    has_detected = False
    if layout_path.exists():
        try:
            conn = sqlite3.connect(str(layout_path))
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM layout_page")
            row = cur.fetchone()
            pages = row[0] if row else 0
            conn.close()
            has_detected = pages > 0
        except Exception:
            pass

    csv_files = [f.name for f in amc_proj.project_dir.glob("*.csv") if f.is_file()]
    default_csv = "list.csv" if "list.csv" in csv_files else (csv_files[0] if csv_files else None)

    return {
        "name": name,
        "has_compiled": sujet_path.exists(),
        "has_detected": has_detected,
        "pages": pages,
        "csv_files": csv_files,
        "default_csv": default_csv
    }



@router.post("/{name}/mark")
def mark_project(name: str, payload: MarkRequest):
    amc_proj = get_amc_project(name)
    if not amc_proj.project_dir.exists():
        raise HTTPException(status_code=404, detail="Project not found")
        
    try:
        if payload.update_scale:
            tex_files = [f for f in amc_proj.project_dir.glob("*.tex") if not f.name.startswith("amc-compiled")]
            if not tex_files:
                tex_files = list(amc_proj.project_dir.glob("*.tex"))
            if not tex_files:
                raise HTTPException(status_code=400, detail="No .tex file found in project to update marking scale.")
            amc_proj.prepare_scoring(str(tex_files[0]))
            
        postcorrect_args = None
        if payload.postcorrect_student is not None:
            postcorrect_args = (
                payload.postcorrect_student,
                payload.postcorrect_copy if payload.postcorrect_copy is not None else 0,
                bool(payload.postcorrect_set_multiple)
            )
        amc_proj.note(load_settings(), postcorrect=postcorrect_args)
        return {"message": "Marking completed successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{name}/postcorrect_status")
def get_postcorrect_status(name: str):
    amc_proj = get_amc_project(name)
    if not amc_proj.project_dir.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    
    is_pc = amc_proj.is_postcorrect()
    sheets = []
    default_student = 1
    default_copy = 0
    default_set_multiple = True

    if is_pc:
        sheets = amc_proj.get_postcorrect_sheets()
        if sheets:
            default_student = sheets[0]["student"]
            default_copy = sheets[0]["copy"]

        scoring_db = amc_proj.data_dir / "scoring.sqlite"
        if scoring_db.exists():
            try:
                conn = sqlite3.connect(scoring_db)
                cur = conn.cursor()
                rows = dict(cur.execute("SELECT name, value FROM scoring_variables WHERE name LIKE 'postcorrect%'").fetchall())
                if 'postcorrect_student' in rows and rows['postcorrect_student'] is not None:
                    try:
                        s_val = int(rows['postcorrect_student'])
                        if any(sh['student'] == s_val for sh in sheets):
                            default_student = s_val
                    except ValueError:
                        pass
                if 'postcorrect_copy' in rows and rows['postcorrect_copy'] is not None:
                    try:
                        default_copy = int(rows['postcorrect_copy'])
                    except ValueError:
                        pass
                if 'postcorrect_set_multiple' in rows and rows['postcorrect_set_multiple'] is not None:
                    default_set_multiple = str(rows['postcorrect_set_multiple']).strip() == '1'
                conn.close()
            except Exception as e:
                print(f"Error reading saved postcorrect variables: {e}")

    return {
        "is_postcorrect": is_pc,
        "sheets": sheets,
        "default_student": default_student,
        "default_copy": default_copy,
        "default_set_multiple": default_set_multiple
    }

class EditCsvRequest(BaseModel):
    filename: str

class ManualAssociationUpdate(BaseModel):
    student: int
    page: int
    copy: int = 0
    primary_key: str
    value: Optional[str] = None

class AutomaticAssociationRequest(BaseModel):
    csv_file: str
    primary_key: str
    code_name: str

class CsvUpdate(BaseModel):
    headers: List[str]
    rows: List[List[str]]

class MarksExportRequest(BaseModel):
    csv_file: str
    primary_key: str
    sorting: str = 'name'
    separator: str = ';'
    export_columns: Optional[List[str]] = None
    include_absentees: bool = False

class AnnotatePapersRequest(BaseModel):
    csv_file: str
    primary_key: str
    output_mode: str  # per_student | all_students
    include_subject: bool = False
    selected_values: List[str] = []
    filename_model: Optional[str] = None

def format_filename_model(model: Optional[str], candidate: dict) -> str:
    """Substitute (N), (ID), and CSV column tokens from filename model."""
    pattern = model.strip() if model and model.strip() else '(N)-(ID)'
    exam = candidate.get('exam', 1)
    copy = candidate.get('copy', 0)
    if copy and str(copy) != '0':
        ex_str = f"{exam:04d}:{copy:04d}"
    else:
        ex_str = f"{exam:04d}"

    res = re.sub(r'\(N\)', ex_str, pattern, flags=re.IGNORECASE)
    val = str(candidate.get('value', ''))
    res = re.sub(r'\(ID\)', val, res, flags=re.IGNORECASE)
    student_data = candidate.get('student', {})
    for k, v in student_data.items():
        if v is not None:
            res = re.sub(r'\(' + re.escape(k) + r'\)', str(v), res, flags=re.IGNORECASE)
            res = re.sub(r'%\(' + re.escape(k) + r'\)', str(v), res, flags=re.IGNORECASE)
    res = re.sub(r'\(exam\)', str(exam), res, flags=re.IGNORECASE)
    res = re.sub(r'\(student\)', str(exam), res, flags=re.IGNORECASE)
    res = re.sub(r'[\\/:*?"<>|]+', '_', res)
    if not res.lower().endswith('.pdf'):
        res += '.pdf'
    return res

def get_project_file(project: AMCProject, filename: str, suffix: str | None = None) -> Path:
    """Resolve a project-owned file without permitting traversal outside the project."""
    candidate = (project.project_dir / filename).resolve()
    if candidate.parent != project.project_dir.resolve() or (suffix and candidate.suffix.lower() != suffix):
        raise HTTPException(status_code=400, detail="Invalid project file")
    return candidate

def get_amc_code_declarations(project: AMCProject) -> dict[str, int]:
    """Read numeric identifiers declared as \\AMCcode{name}{digits} from the subject."""
    tex_files = [path for path in project.project_dir.glob('*.tex') if not path.name.startswith('amc-compiled')]
    declarations: dict[str, int] = {}
    for tex_file in tex_files:
        try:
            content = tex_file.read_text(encoding='utf-8')
        except (OSError, UnicodeDecodeError):
            continue
        for code_name, digits in re.findall(r'\\AMCcode\s*\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\s*\{\s*(\d+)\s*\}', content):
            declarations[code_name] = int(digits)
    return declarations

def get_association_status(project: AMCProject, primary_key: str) -> dict:
    """Merge AMC automatic association with this app's image-based manual mapping."""
    capture_path = project.data_dir / 'capture.sqlite'
    if not capture_path.exists():
        return {"total": 0, "matched": 0, "missing": 0, "automatic": 0, "automatic_run": False, "codes": {}}

    capture_conn = sqlite3.connect(capture_path)
    capture_cur = capture_conn.cursor()
    sheets = set(capture_cur.execute('SELECT DISTINCT student, copy FROM capture_page').fetchall())
    manual = {}
    manual_table = capture_cur.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='manual_association'").fetchone()
    if manual_table:
        for student, copy, value in capture_cur.execute('''
            SELECT student, copy, value FROM manual_association
            WHERE primary_key=? AND value NOT IN ('', 'Unknown')
        ''', (primary_key,)):
            manual[(student, copy)] = value
    capture_conn.close()

    automatic = {}
    automatic_run = False
    association_path = project.data_dir / 'association.sqlite'
    if association_path.exists():
        association_conn = sqlite3.connect(association_path)
        association_cur = association_conn.cursor()
        tables = {row[0] for row in association_cur.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if {'association_variables', 'association_association'} <= tables:
            variables = dict(association_cur.execute('SELECT name, value FROM association_variables'))
            automatic_run = variables.get('key_in_list') == primary_key and bool(variables.get('code'))
            if automatic_run:
                for student, copy, value in association_cur.execute('''
                    SELECT student, copy, auto FROM association_association
                    WHERE auto IS NOT NULL AND auto <> ''
                '''):
                    automatic[(student, copy)] = value
        association_conn.close()

    codes = {}
    scoring_path = project.data_dir / 'scoring.sqlite'
    if scoring_path.exists():
        score_conn = sqlite3.connect(scoring_path)
        try:
            for student, copy, code, value in score_conn.execute('SELECT student, copy, code, value FROM scoring_code'):
                codes.setdefault((student, copy), {})[code] = value
        except sqlite3.Error:
            pass
        score_conn.close()

    matched_sheets = set(automatic) | set(manual)
    return {
        "total": len(sheets), "matched": len(sheets & matched_sheets),
        "missing": len(sheets - matched_sheets), "automatic": len(sheets & set(automatic)),
        "automatic_run": automatic_run, "codes": codes, "automatic_values": automatic, "manual_values": manual,
    }

@router.get("/{name}/csv_files")
def list_csv_files(name: str):
    amc_proj = get_amc_project(name)
    csv_files = [f.name for f in amc_proj.project_dir.glob("*.csv") if f.is_file()]
    return {"files": csv_files}

@router.get("/{name}/automatic_association_codes")
def get_automatic_association_codes(name: str):
    project = get_amc_project(name)
    declarations = get_amc_code_declarations(project)
    return {"codes": [{"name": code_name, "digits": digits} for code_name, digits in declarations.items()]}

@router.post("/{name}/automatic_association")
def run_automatic_association(name: str, request: AutomaticAssociationRequest):
    project = get_amc_project(name)
    csv_path = get_project_file(project, request.csv_file, '.csv')
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="Students CSV file not found")
    declarations = get_amc_code_declarations(project)
    if request.code_name not in declarations:
        raise HTTPException(status_code=400, detail="The selected code name was not declared with \\AMCcode in the LaTeX subject")
    try:
        with csv_path.open('r', encoding='utf-8-sig', newline='') as csv_file:
            reader = csv.DictReader(csv_file)
            if not reader.fieldnames or request.primary_key not in reader.fieldnames:
                raise HTTPException(status_code=400, detail="Primary key was not found in the students CSV")
        scoring_path = project.data_dir / 'scoring.sqlite'
        if not scoring_path.exists():
            raise HTTPException(status_code=400, detail="No decoded AMC codes were found. Complete Data Capture and Marking first.")
        score_conn = sqlite3.connect(scoring_path)
        available = score_conn.execute('SELECT COUNT(*) FROM scoring_code WHERE code=?', (request.code_name,)).fetchone()[0]
        score_conn.close()
        if not available:
            raise HTTPException(status_code=400, detail=f"No values were decoded for AMC code '{request.code_name}'. Complete Data Capture and Marking, then inspect invalid sheets in Diagnosis.")
        project.association_auto_with_options(str(csv_path), request.primary_key, request.code_name)
        status = get_association_status(project, request.primary_key)
        unrecognized = []
        for (student, copy), code_values in status["codes"].items():
            if (student, copy) not in status["automatic_values"] and (student, copy) not in status["manual_values"]:
                unrecognized.append({"student": student, "copy": copy, "value": code_values.get(request.code_name, "")})
        return {
            "message": "Automatic association completed",
            "matched": status["matched"], "total": status["total"], "misclassified": status["missing"],
            "unrecognized": unrecognized,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{name}/csv_headers")
def get_csv_headers(name: str, file: str):
    amc_proj = get_amc_project(name)
    csv_path = get_project_file(amc_proj, file, '.csv')
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="CSV file not found")
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            first_line = f.readline().strip()
        headers = [h.strip() for h in first_line.split(',') if h.strip()]
        return {"headers": headers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{name}/csv")
def get_csv_file(name: str, file: str):
    amc_proj = get_amc_project(name)
    csv_path = get_project_file(amc_proj, file, '.csv')
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="CSV file not found")
    try:
        with open(csv_path, 'r', encoding='utf-8-sig', newline='') as csv_file:
            reader = csv.reader(csv_file)
            content = list(reader)
        return {"headers": content[0] if content else [], "rows": content[1:] if content else []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{name}/csv")
def update_csv_file(name: str, file: str, update: CsvUpdate):
    amc_proj = get_amc_project(name)
    csv_path = get_project_file(amc_proj, file, '.csv')
    headers = [header.strip() for header in update.headers]
    if not headers or any(not header for header in headers) or len(set(headers)) != len(headers):
        raise HTTPException(status_code=400, detail="CSV headers must be non-empty and unique")
    try:
        output = io.StringIO(newline='')
        writer = csv.writer(output)
        writer.writerow(headers)
        for row in update.rows:
            writer.writerow([str(row[index]) if index < len(row) else '' for index in range(len(headers))])
        csv_path.write_text(output.getvalue(), encoding='utf-8', newline='')
        return {"message": "CSV saved", "headers": headers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{name}/reports/marks_export")
def export_marks(name: str, request: MarksExportRequest):
    """Build a project CSV with the computed marks and score for every question."""
    amc_proj = get_amc_project(name)
    csv_path = get_project_file(amc_proj, request.csv_file, '.csv')
    scoring_path = amc_proj.data_dir / 'scoring.sqlite'
    capture_path = amc_proj.data_dir / 'capture.sqlite'
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="Students CSV file not found")
    if not scoring_path.exists():
        raise HTTPException(status_code=400, detail="No computed marks were found")
    try:
        with open(csv_path, 'r', encoding='utf-8-sig', newline='') as csv_file:
            student_rows = list(csv.DictReader(csv_file))
        if not student_rows or request.primary_key not in (student_rows[0] or {}):
            raise HTTPException(status_code=400, detail="Primary key was not found in the students CSV")
        students_by_key = {row.get(request.primary_key, '').strip(): (index, row) for index, row in enumerate(student_rows) if row.get(request.primary_key, '').strip()}

        score_conn = sqlite3.connect(scoring_path)
        score_conn.row_factory = sqlite3.Row
        score_cur = score_conn.cursor()
        question_titles = score_cur.execute('SELECT question, title FROM scoring_title ORDER BY question').fetchall()
        if not question_titles:
            question_titles = score_cur.execute('SELECT DISTINCT question, "Question " || question AS title FROM scoring_score ORDER BY question').fetchall()
        question_ids = [row['question'] for row in question_titles]
        question_headers = [row['title'] or f"Question {row['question']}" for row in question_titles]
        marks = score_cur.execute('SELECT student, copy, mark FROM scoring_mark ORDER BY student, copy').fetchall()
        scores = score_cur.execute('SELECT student, copy, question, score FROM scoring_score').fetchall()
        score_conn.close()

        score_by_exam = {}
        for score in scores:
            score_by_exam.setdefault((score['student'], score['copy']), {})[score['question']] = score['score']

        association_status = get_association_status(amc_proj, request.primary_key)
        associations = association_status['automatic_values'].copy()
        associations.update(association_status['manual_values'])

        exported_rows = []
        assigned_keys = set()
        for mark in marks:
            exam = mark['student']
            copy = mark['copy']
            key_value = associations.get((exam, copy), '')
            if key_value:
                assigned_keys.add(key_value)
            list_position, student = students_by_key.get(key_value, (None, {}))
            exported_rows.append({
                'exam': exam,
                'copy': copy,
                'student_key': key_value or '?',
                'name': student.get('name', '?') or '?',
                'student': student,
                'mark': mark['mark'],
                'scores': score_by_exam.get((exam, copy), {}),
                'list_position': list_position,
                'is_absentee': False,
            })

        if request.include_absentees:
            for key_value, (index, student) in students_by_key.items():
                if key_value not in assigned_keys:
                    exported_rows.append({
                        'exam': '',
                        'copy': '',
                        'student_key': key_value,
                        'name': student.get('name', '') or student.get('nom', '') or '',
                        'student': student,
                        'mark': '',
                        'scores': {},
                        'list_position': index,
                        'is_absentee': True,
                    })

        if request.sorting == 'name':
            exported_rows.sort(key=lambda row: (row['name'] == '?', str(row['name']).casefold(), str(row['exam']), str(row['copy'])))
        elif request.sorting == 'line_in_students_list':
            exported_rows.sort(key=lambda row: (row['list_position'] is None, row['list_position'] if row['list_position'] is not None else row['exam']))
        elif request.sorting == 'mark_ascending':
            exported_rows.sort(key=lambda row: (row['mark'] is None or row['mark'] == '', float(row['mark']) if row['mark'] not in (None, '') else 0, str(row['exam'])))
        elif request.sorting == 'mark_descending':
            exported_rows.sort(key=lambda row: (row['mark'] is None or row['mark'] == '', -(float(row['mark'])) if row['mark'] not in (None, '') else 0, str(row['exam'])))
        else:  # exam_copy_number
            exported_rows.sort(key=lambda row: (str(row['exam']), str(row['copy'])))

        amc_proj.exports_dir.mkdir(parents=True, exist_ok=True)
        output_path = amc_proj.exports_dir / 'marks.csv'
        if request.separator not in (',', ';'):
            raise HTTPException(status_code=400, detail="Separator must be a comma or semicolon")

        # Determine output columns
        selected_cols = request.export_columns
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as output_file:
            writer = csv.writer(output_file, delimiter=request.separator)
            
            if selected_cols:
                # Custom columns requested
                headers = []
                for c in selected_cols:
                    if c in ('<student copy>', 'student.copy'):
                        headers.append('<student copy>')
                    elif c in ('<student identifier>', 'student.key'):
                        headers.append('<student identifier>')
                    elif c in ('<full name>', 'student.name'):
                        headers.append('<full name>')
                    else:
                        headers.append(c)
                if 'Mark' not in headers:
                    headers.append('Mark')
                headers.extend(question_headers)
                writer.writerow(headers)

                for row in exported_rows:
                    out_row = []
                    for c in selected_cols:
                        if c in ('<student copy>', 'student.copy'):
                            if row['copy'] and str(row['copy']) != '0':
                                out_row.append(f"{row['exam']}:{row['copy']}")
                            else:
                                out_row.append(str(row['exam']) if row['exam'] != '' else '')
                        elif c in ('<student identifier>', 'student.key'):
                            out_row.append(row['student_key'])
                        elif c in ('<full name>', 'student.name'):
                            out_row.append(row['name'])
                        elif c == 'Mark':
                            out_row.append(row['mark'])
                        else:
                            out_row.append(row['student'].get(c, ''))
                    if 'Mark' not in selected_cols:
                        out_row.append(row['mark'])
                    out_row.extend([row['scores'].get(question_id, '') for question_id in question_ids])
                    writer.writerow(out_row)
            else:
                # Default columns
                writer.writerow(['Exam', request.primary_key, 'Name', 'Mark', *question_headers])
                for row in exported_rows:
                    writer.writerow([
                        f"{row['exam']}:{row['copy']}" if row['copy'] and str(row['copy']) != '0' else str(row['exam']),
                        row['student_key'], row['name'], row['mark'],
                        *[row['scores'].get(question_id, '') for question_id in question_ids],
                    ])
        return FileResponse(output_path, filename='marks.csv', media_type='text/csv')
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{name}/reports/open_exports_directory")
def open_exports_directory(name: str):
    amc_proj = get_amc_project(name)
    amc_proj.exports_dir.mkdir(parents=True, exist_ok=True)
    if os.name != 'nt':
        raise HTTPException(status_code=501, detail="Opening the exports directory requires the backend to run on Windows.")
    try:
        os.startfile(str(amc_proj.exports_dir))
        return {"message": "Exports directory opened"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def get_matched_students(project: AMCProject, csv_file: str, primary_key: str):
    csv_path = get_project_file(project, csv_file, '.csv')
    with open(csv_path, 'r', encoding='utf-8-sig', newline='') as handle:
        students = list(csv.DictReader(handle))
    status = get_association_status(project, primary_key)
    assignments = status['automatic_values'].copy()
    assignments.update(status['manual_values'])
    by_key = {row.get(primary_key, '').strip(): row for row in students}
    return [
        {"exam": student, "copy": copy, "value": value, "student": by_key[value]}
        for (student, copy), value in sorted(assignments.items()) if value in by_key
    ]

def prepend_subject_pages(project: AMCProject, target: Path, student: int, annotated_source: Path):
    """Create a correction PDF with this student's original subject pages first."""
    output = fitz.open()
    subject_pdf = project.project_dir / 'DOC-sujet.pdf'
    layout_path = project.data_dir / 'layout.sqlite'
    if subject_pdf.exists() and layout_path.exists():
        layout_conn = sqlite3.connect(layout_path)
        pages = layout_conn.execute('SELECT subjectpage FROM layout_page WHERE student=? ORDER BY page', (student,)).fetchall()
        layout_conn.close()
        subject_doc = fitz.open(subject_pdf)
        for (page_number,) in pages:
            page_index = int(page_number) - 1
            if 0 <= page_index < len(subject_doc):
                output.insert_pdf(subject_doc, from_page=page_index, to_page=page_index)
        subject_doc.close()
    annotated_doc = fitz.open(annotated_source)
    output.insert_pdf(annotated_doc)
    annotated_doc.close()
    output.save(target)
    output.close()

@router.get("/{name}/reports/annotate_candidates")
def get_annotate_candidates(name: str, file: str, primary_key: str):
    project = get_amc_project(name)
    try:
        candidates = get_matched_students(project, file, primary_key)
        return {"students": [{"value": item['value'], "name": item['student'].get('name', ''), "forename": item['student'].get('forename', '')} for item in candidates]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{name}/reports/annotate_options")
def get_annotate_options(name: str):
    project = get_amc_project(name)
    model = project.get_option("modele_regroupement", "(N)-(ID)")
    return {"filename_model": model}

@router.post("/{name}/reports/annotate_papers")
def annotate_papers(name: str, request: AnnotatePapersRequest):
    project = get_amc_project(name)
    try:
        if request.filename_model is not None:
            project.set_option("modele_regroupement", request.filename_model.strip())

        candidates = get_matched_students(project, request.csv_file, request.primary_key)
        if request.selected_values:
            selected = set(request.selected_values)
            candidates = [item for item in candidates if item['value'] in selected]
        if not candidates:
            raise HTTPException(status_code=400, detail="No matched students were selected for annotation")

        corrections_dir = project.cr_dir / 'corrections' / 'pdf'
        corrections_dir.mkdir(parents=True, exist_ok=True)
        # AMC keeps an existing correction when it considers it up to date.
        # Remove only its unnamed intermediate files (for example 0001.pdf),
        # never the application's final annotated-* exports, so it rebuilds
        # annotations from the latest scanned pages and capture database.
        for existing in corrections_dir.glob('*.pdf'):
            if not existing.name.startswith('annotated-'):
                try:
                    existing.unlink()
                except Exception:
                    pass
        # AMC creates annotated PDFs below cr/. The project CLI wrapper preserves AMC's native annotations.
        amc_cmd = [
            'auto-multiple-choice', 'annotate', '--project', str(project.project_dir),
            '--data', str(project.data_dir), '--cr', str(project.cr_dir),
            '--names-file', str(get_project_file(project, request.csv_file, '.csv')),
        ]
        if request.filename_model and request.filename_model.strip():
            amc_cmd.extend(['--filename-model', request.filename_model.strip()])
        project._run_amc(amc_cmd, strict=True)

        # AMC's native annotate command writes its per-copy PDFs to cr/corrections/pdf.
        # Do not exclude that folder: it is the actual source for the final exports.
        generated = sorted(path for path in corrections_dir.glob('*.pdf') if not path.name.startswith('annotated-') and path.stat().st_size > 2_000)
        if not generated:
            raise HTTPException(status_code=500, detail="AMC did not generate usable annotated PDFs. Confirm that data capture and marking have completed, then review the AMC command output.")

        # AMC output names vary by version. Keep the files it generated in the requested correction folder.
        timestamp = int(time.time())
        outputs = []
        report_db = project.data_dir / 'report.sqlite'
        rconn = sqlite3.connect(report_db) if report_db.exists() else None

        for index, candidate in enumerate(candidates, start=1):
            exam_num = candidate.get('exam', 1)
            exam_prefix = f"{exam_num:04d}"
            matching = [p for p in generated if p.name.startswith(exam_prefix)]
            source = matching[0] if matching else generated[min(index - 1, len(generated) - 1)]
            safe_value = re.sub(r'[^A-Za-z0-9._-]+', '_', candidate['value'])

            # Determine filename from filename_model if per_student
            if request.output_mode == 'per_student' and request.filename_model and request.filename_model.strip():
                dest_filename = format_filename_model(request.filename_model, candidate)
            else:
                dest_filename = f'annotated-{safe_value}-{candidate["exam"]}.pdf'

            output = corrections_dir / dest_filename
            if request.include_subject:
                prepend_subject_pages(project, output, candidate['exam'], source)
            else:
                if source.resolve() != output.resolve():
                    shutil.copy2(source, output)
            outputs.append(output)

            # Ensure backward-compatible annotated- alias exists if custom model used
            legacy_output = corrections_dir / f'annotated-{safe_value}-{candidate["exam"]}.pdf'
            if legacy_output.resolve() != output.resolve() and output.exists():
                try:
                    shutil.copy2(output, legacy_output)
                except Exception:
                    pass

            # Register in report_student table
            if rconn:
                try:
                    rconn.execute("""
                        INSERT INTO report_student (type, file, student, copy, timestamp)
                        VALUES (1, ?, ?, ?, ?)
                        ON CONFLICT(type, student, copy) DO UPDATE SET file=excluded.file, timestamp=excluded.timestamp
                    """, (dest_filename, candidate['exam'], candidate.get('copy', 0), int(time.time())))
                except Exception as ex:
                    print(f"Error registering report_student: {ex}")

        if rconn:
            rconn.commit()
            rconn.close()

        if request.output_mode == 'all_students':
            merged = fitz.open()
            for source in outputs:
                source_doc = fitz.open(source)
                merged.insert_pdf(source_doc)
                source_doc.close()
            output = corrections_dir / f'annotated-all-{timestamp}.pdf'
            merged.save(output)
            merged.close()
            return {"files": [str(output.relative_to(project.project_dir))]}
        return {"files": [str(output.relative_to(project.project_dir)) for output in outputs]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

EMAIL_ADDRESS_PATTERN = re.compile(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$')

def is_valid_email_address(addr: str) -> bool:
    if not addr or not isinstance(addr, str):
        return False
    return bool(EMAIL_ADDRESS_PATTERN.match(addr.strip()))

def find_email_columns(rows: List[dict]) -> tuple[List[str], str]:
    if not rows:
        return [], ""
    headers = list(rows[0].keys())
    counts = {}
    for h in headers:
        c = sum(1 for r in rows if is_valid_email_address(r.get(h, '')))
        if c > 0:
            counts[h] = c
    if not counts:
        return [], ""
    sorted_headers = sorted(counts.keys(), key=lambda k: counts[k], reverse=True)
    return list(counts.keys()), sorted_headers[0]

def format_score_value(value: Optional[float], digits: int = 4) -> str:
    if value is None:
        return ""
    try:
        val = float(value)
        if val.is_integer():
            return str(int(val))
        return f"{val:.{digits}g}"
    except Exception:
        return str(value)

def substitute_email_message(template: str, student_data: dict, exam_name: str, mark_info: dict) -> str:
    text = template
    text = re.sub(r'%s', format_score_value(mark_info.get('mark')), text)
    text = re.sub(r'%m', format_score_value(mark_info.get('mark_max')), text)
    text = re.sub(r'%S', format_score_value(mark_info.get('total')), text)
    text = re.sub(r'%M', format_score_value(mark_info.get('max')), text)
    text = re.sub(r'%n', exam_name or '', text)

    def replace_col(match):
        col = match.group(1).strip()
        if col in student_data:
            return str(student_data[col])
        for k, v in student_data.items():
            if k.lower() == col.lower():
                return str(v)
        return ""

    text = re.sub(r'%\(([A-Za-z0-9_ -]+)\)', replace_col, text)
    return text

class MailingSendRequest(BaseModel):
    csv_file: str
    primary_key: str
    email_col: str
    exam_name: str = ""
    subject: str
    body: str
    use_html: bool = False
    selected_exams: List[int] = []
    attachments: List[str] = []

@router.get("/{name}/reports/mailing/preview")
def preview_report_mailing(name: str, csv_file: Optional[str] = None, primary_key: Optional[str] = None):
    project = get_amc_project(name)
    settings = load_settings()
    sender_email = settings.get("email_sender", "").strip()

    # 1. Prerequisite: Check sender email
    if not sender_email or not is_valid_email_address(sender_email):
        return {
            "status": "error",
            "code": "INVALID_SENDER_EMAIL",
            "message": "Bạn chưa điền email người gửi hoặc địa chỉ email không hợp lệ. Vui lòng vào Cài đặt (Preferences) -> tab Email để điền chính xác Email người gửi."
        }

    # 2. Prerequisite: Check annotated PDFs
    corrections_dir = project.cr_dir / 'corrections' / 'pdf'
    report_db = project.data_dir / 'report.sqlite'
    has_annotated_pdfs = False
    if corrections_dir.exists() and any(f.suffix.lower() == '.pdf' for f in corrections_dir.glob('*.pdf')):
        has_annotated_pdfs = True
    if report_db.exists():
        try:
            rconn = sqlite3.connect(report_db)
            c = rconn.execute('SELECT COUNT(*) FROM report_student WHERE type=1').fetchone()
            rconn.close()
            if c and c[0] > 0:
                has_annotated_pdfs = True
        except Exception:
            pass

    if not has_annotated_pdfs:
        return {
            "status": "error",
            "code": "NO_ANNOTATED_PDFS",
            "message": "Không tìm thấy bài làm đã chấm (PDF) nào để gửi. Vui lòng thực hiện chấm bài và tạo bài chấm (Annotate papers) trước."
        }

    # 3. Prerequisite: Check students CSV and email columns
    available_csvs = [f.name for f in project.project_dir.glob("*.csv") if f.is_file()]
    resolved_csv = csv_file
    if not resolved_csv or resolved_csv in ('null', 'undefined'):
        if "list.csv" in available_csvs:
            resolved_csv = "list.csv"
        elif available_csvs:
            resolved_csv = available_csvs[0]
        else:
            return {
                "status": "error",
                "code": "NO_CSV_FILE",
                "message": "Không tìm thấy file danh sách học sinh (.csv) nào trong thư mục dự án. Vui lòng tải lên file CSV danh sách học sinh ở tab Marking."
            }

    csv_path = get_project_file(project, resolved_csv, '.csv')
    if not csv_path.exists():
        return {
            "status": "error",
            "code": "NO_CSV_FILE",
            "message": f"Không tìm thấy file danh sách học sinh '{resolved_csv}' trong thư mục dự án."
        }

    with open(csv_path, 'r', encoding='utf-8-sig', newline='') as f:
        student_rows = list(csv.DictReader(f))

    if not student_rows:
        return {
            "status": "error",
            "code": "EMPTY_STUDENTS_LIST",
            "message": f"File danh sách học sinh '{resolved_csv}' đang trống."
        }

    email_cols, col_max = find_email_columns(student_rows)
    if not email_cols:
        return {
            "status": "error",
            "code": "NO_EMAIL_COLUMN",
            "message": "Không tìm thấy cột nào chứa địa chỉ email hợp lệ trong file danh sách học sinh. Vui lòng bổ sung cột email vào file CSV."
        }

    first_row_keys = list(student_rows[0].keys())
    resolved_pk = primary_key
    if not resolved_pk or resolved_pk in ('null', 'undefined') or resolved_pk not in first_row_keys:
        resolved_pk = 'id' if 'id' in first_row_keys else (first_row_keys[0] if first_row_keys else 'id')

    # Previous mailing statuses
    mail_statuses = {}
    if report_db.exists():
        try:
            rconn = sqlite3.connect(report_db)
            rconn.row_factory = sqlite3.Row
            for row in rconn.execute('SELECT student, copy, file, mail_status, mail_message, mail_timestamp FROM report_student WHERE type=1'):
                mail_statuses[(row['student'], row['copy'])] = {
                    "file": row['file'],
                    "mail_status": row['mail_status'],
                    "mail_message": row['mail_message'] or "",
                    "mail_timestamp": row['mail_timestamp']
                }
            rconn.close()
        except Exception:
            pass

    # Scoring info
    scoring_db = project.data_dir / 'scoring.sqlite'
    marks_by_exam = {}
    mark_max = 20.0
    if scoring_db.exists():
        try:
            sconn = sqlite3.connect(scoring_db)
            sconn.row_factory = sqlite3.Row
            var_row = sconn.execute("SELECT value FROM scoring_variables WHERE name='mark_max'").fetchone()
            if var_row and var_row['value']:
                try:
                    mark_max = float(var_row['value'])
                except Exception:
                    pass
            for m in sconn.execute('SELECT student, copy, mark, total, max FROM scoring_mark'):
                marks_by_exam[(m['student'], m['copy'])] = {
                    "mark": m['mark'],
                    "total": m['total'],
                    "max": m['max'],
                    "mark_max": mark_max
                }
            sconn.close()
        except Exception:
            pass

    candidates = get_matched_students(project, resolved_csv, resolved_pk)
    students_preview = []
    for cand in candidates:
        exam = cand['exam']
        copy = cand['copy']
        val = cand['value']
        s_data = cand['student']

        safe_val = re.sub(r'[^A-Za-z0-9._-]+', '_', val)
        candidate_pdf = corrections_dir / f"annotated-{safe_val}-{exam}.pdf"
        registered_info = mail_statuses.get((exam, copy), {})
        registered_pdf = corrections_dir / registered_info.get("file", "") if registered_info.get("file") else None

        has_pdf = (candidate_pdf.exists() and candidate_pdf.stat().st_size > 500) or (registered_pdf and registered_pdf.exists() and registered_pdf.stat().st_size > 500)

        status_code = registered_info.get("mail_status", 0)
        status_str = "done" if status_code == 1 else ("failed" if status_code == 100 else "")

        mark_info = marks_by_exam.get((exam, copy), {})

        student_name = s_data.get('name', '')
        if s_data.get('forename'):
            student_name = f"{student_name} {s_data.get('forename')}".strip()
        if not student_name:
            student_name = val

        students_preview.append({
            "exam": exam,
            "copy": copy,
            "sc": f"{exam}" if copy == 0 else f"{exam}:{copy}",
            "id": val,
            "name": student_name,
            "email": s_data.get(col_max, ''),
            "email_values": {c: str(s_data.get(c, '')) for c in email_cols},
            "status": status_str,
            "mail_message": registered_info.get("mail_message", ""),
            "has_pdf": has_pdf,
            "mark": mark_info.get("mark"),
            "max_mark": mark_info.get("mark_max", mark_max),
        })

    default_subject = settings.get("df_annotatedemail_email_subject", "Exam result")
    default_body = settings.get("df_annotatedemail_email_text", "Please find enclosed your annotated completed answer sheet.\nRegards.")
    exam_name = name

    available_files = []
    for f in project.project_dir.glob("*.pdf"):
        if not f.name.startswith("annotated-"):
            available_files.append(f.name)

    return {
        "status": "ok",
        "project_name": name,
        "exam_name": exam_name,
        "csv_file": resolved_csv,
        "primary_key": resolved_pk,
        "available_csvs": available_csvs,
        "email_columns": email_cols,
        "default_email_col": col_max,
        "students": students_preview,
        "default_subject": default_subject,
        "default_body": default_body,
        "use_html": False,
        "sender": sender_email,
        "available_files": sorted(available_files),
    }

@router.post("/{name}/reports/mailing/send")
def send_report_mailing(name: str, req: MailingSendRequest):
    project = get_amc_project(name)
    settings = load_settings()

    host = settings.get("email_smtp_host", "smtp.gmail.com")
    port = int(settings.get("email_smtp_port", 465))
    security = settings.get("email_smtp_ssl", "SSL")
    user = settings.get("email_smtp_user", "")
    password = settings.get("email_smtp_password", "")
    sender = settings.get("email_sender", "") or user
    cc = settings.get("email_cc", "")
    bcc = settings.get("email_bcc", "")
    delay = max(0.0, float(settings.get("email_delay", 0.0)))

    if not sender or not is_valid_email_address(sender):
        raise HTTPException(status_code=400, detail="Sender email is not configured or invalid.")

    if not req.selected_exams:
        raise HTTPException(status_code=400, detail="No students were selected for mailing.")

    # Remember subject and body templates in settings
    if req.subject:
        settings["df_annotatedemail_email_subject"] = req.subject
    if req.body:
        settings["df_annotatedemail_email_text"] = req.body
    save_settings(settings)

    available_csvs = [f.name for f in project.project_dir.glob("*.csv") if f.is_file()]
    resolved_csv = req.csv_file
    if not resolved_csv or resolved_csv in ('null', 'undefined'):
        if "list.csv" in available_csvs:
            resolved_csv = "list.csv"
        elif available_csvs:
            resolved_csv = available_csvs[0]
        else:
            raise HTTPException(status_code=400, detail="Không tìm thấy file CSV danh sách học sinh nào trong dự án.")

    csv_path = get_project_file(project, resolved_csv, '.csv')
    with open(csv_path, 'r', encoding='utf-8-sig', newline='') as f:
        student_rows = list(csv.DictReader(f))

    first_row_keys = list(student_rows[0].keys()) if student_rows else []
    resolved_pk = req.primary_key
    if not resolved_pk or resolved_pk in ('null', 'undefined') or resolved_pk not in first_row_keys:
        resolved_pk = 'id' if 'id' in first_row_keys else (first_row_keys[0] if first_row_keys else 'id')

    candidates = get_matched_students(project, resolved_csv, resolved_pk)
    candidate_map = {c['exam']: c for c in candidates}

    scoring_db = project.data_dir / 'scoring.sqlite'
    marks_by_exam = {}
    mark_max = 20.0
    if scoring_db.exists():
        try:
            sconn = sqlite3.connect(scoring_db)
            sconn.row_factory = sqlite3.Row
            var_row = sconn.execute("SELECT value FROM scoring_variables WHERE name='mark_max'").fetchone()
            if var_row and var_row['value']:
                try:
                    mark_max = float(var_row['value'])
                except Exception:
                    pass
            for m in sconn.execute('SELECT student, copy, mark, total, max FROM scoring_mark'):
                marks_by_exam[(m['student'], m['copy'])] = {
                    "mark": m['mark'],
                    "total": m['total'],
                    "max": m['max'],
                    "mark_max": mark_max
                }
            sconn.close()
        except Exception:
            pass

    corrections_dir = project.cr_dir / 'corrections' / 'pdf'
    report_db = project.data_dir / 'report.sqlite'

    rconn = sqlite3.connect(report_db)
    rcur = rconn.cursor()
    rcur.execute("""
        CREATE TABLE IF NOT EXISTS report_student (
            type INTEGER, file TEXT, student INTEGER, copy INTEGER DEFAULT 0,
            timestamp INTEGER, mail_status INTEGER DEFAULT 0, mail_timestamp INTEGER DEFAULT 0,
            mail_message TEXT, PRIMARY KEY (type,student,copy)
        )
    """)
    rcur.execute("""
        CREATE TABLE IF NOT EXISTS report_directory (type INTEGER PRIMARY KEY, directory TEXT)
    """)
    rcur.execute("INSERT OR IGNORE INTO report_directory (type, directory) VALUES (1, 'cr/corrections/pdf')")
    rconn.commit()
    rconn.close()

    extra_attachments = []
    for att_name in req.attachments:
        att_path = project.project_dir / att_name
        if att_path.exists() and att_path.is_file():
            try:
                data = att_path.read_bytes()
                extra_attachments.append((att_name, data))
            except Exception as e:
                print(f"Cannot read attachment {att_name}: {e}")

    server = None
    failed_auth = False
    try:
        if security == "SSL":
            server = smtplib.SMTP_SSL(host, port, timeout=20)
        else:
            server = smtplib.SMTP(host, port, timeout=20)
            if security == "STARTTLS":
                server.starttls()
        if user and password:
            server.login(user, password)
    except smtplib.SMTPAuthenticationError as e:
        err_msg = e.smtp_error.decode('utf-8', errors='ignore') if isinstance(e.smtp_error, bytes) else str(e)
        return {
            "success": False,
            "sent_count": 0,
            "failed_count": len(req.selected_exams),
            "failed_auth": True,
            "message": f"SMTP authentication failed: check SMTP configuration and password. ({err_msg})",
            "failures": [{"exam": exam, "error": f"Auth failed: {err_msg}"} for exam in req.selected_exams]
        }
    except Exception as e:
        return {
            "success": False,
            "sent_count": 0,
            "failed_count": len(req.selected_exams),
            "failed_auth": False,
            "message": f"Cannot connect to SMTP server: {str(e)}",
            "failures": [{"exam": exam, "error": str(e)} for exam in req.selected_exams]
        }

    sent_count = 0
    failed_count = 0
    failures = []
    log_lines = [f"{time.ctime()} Starting mailing for project {name}...\n"]

    for exam in req.selected_exams:
        cand = candidate_map.get(exam)
        if not cand:
            continue
        copy = cand['copy']
        val = cand['value']
        s_data = cand['student']
        dest = str(s_data.get(req.email_col, '')).strip()

        now_ts = int(time.time())

        if not dest or not is_valid_email_address(dest):
            err = f"Invalid or empty email: '{dest}'"
            failures.append({"exam": exam, "id": val, "name": s_data.get('name', val), "email": dest, "error": err})
            failed_count += 1
            log_lines.append(f"FAILED [{exam} -> {dest}] {err}\n")
            rconn = sqlite3.connect(report_db)
            rconn.execute("""
                UPDATE report_student
                SET mail_status=100, mail_message=?, mail_timestamp=?
                WHERE type=1 AND student=? AND copy=?
            """, (err, now_ts, exam, copy))
            rconn.commit()
            rconn.close()
            continue

        safe_val = re.sub(r'[^A-Za-z0-9._-]+', '_', val)
        candidate_pdf = corrections_dir / f"annotated-{safe_val}-{exam}.pdf"
        target_pdf = None
        if candidate_pdf.exists() and candidate_pdf.stat().st_size > 500:
            target_pdf = candidate_pdf
        else:
            rconn = sqlite3.connect(report_db)
            rrow = rconn.execute("SELECT file FROM report_student WHERE type=1 AND student=? AND copy=?", (exam, copy)).fetchone()
            rconn.close()
            if rrow and rrow[0]:
                alt_pdf = corrections_dir / rrow[0]
                if alt_pdf.exists() and alt_pdf.stat().st_size > 500:
                    target_pdf = alt_pdf

        if not target_pdf:
            for p in corrections_dir.glob(f"*{exam}.pdf"):
                if p.stat().st_size > 500:
                    target_pdf = p
                    break

        if not target_pdf:
            err = "Annotated PDF file not found"
            failures.append({"exam": exam, "id": val, "name": s_data.get('name', val), "email": dest, "error": err})
            failed_count += 1
            log_lines.append(f"FAILED [{exam} -> {dest}] {err}\n")
            rconn = sqlite3.connect(report_db)
            rconn.execute("""
                UPDATE report_student
                SET mail_status=100, mail_message=?, mail_timestamp=?
                WHERE type=1 AND student=? AND copy=?
            """, (err, now_ts, exam, copy))
            rconn.commit()
            rconn.close()
            continue

        mark_info = marks_by_exam.get((exam, copy), {})
        sub_subject = substitute_email_message(req.subject, s_data, req.exam_name, mark_info)
        sub_body = substitute_email_message(req.body, s_data, req.exam_name, mark_info)

        msg = MIMEMultipart()
        msg['From'] = sender
        msg['To'] = dest
        if cc:
            msg['Cc'] = cc
        msg['Subject'] = sub_subject
        msg['User-Agent'] = "AutoMultipleChoice/AMC-WEB"
        msg['X-Project'] = name
        msg['X-AMC-Student'] = str(exam)

        body_type = 'html' if req.use_html else 'plain'
        msg.attach(MIMEText(sub_body, body_type, 'utf-8'))

        try:
            pdf_bytes = target_pdf.read_bytes()
            part = MIMEApplication(pdf_bytes, Name="corrected.pdf")
            part['Content-Disposition'] = 'attachment; filename="corrected.pdf"'
            msg.attach(part)
        except Exception as e:
            err = f"Failed to read PDF: {e}"
            failures.append({"exam": exam, "id": val, "name": s_data.get('name', val), "email": dest, "error": err})
            failed_count += 1
            log_lines.append(f"FAILED [{exam} -> {dest}] {err}\n")
            continue

        for att_name, att_bytes in extra_attachments:
            try:
                extra_part = MIMEApplication(att_bytes, Name=att_name)
                extra_part['Content-Disposition'] = f'attachment; filename="{att_name}"'
                msg.attach(extra_part)
            except Exception:
                pass

        try:
            recipients = [dest]
            if cc:
                recipients.extend([x.strip() for x in cc.split(',') if is_valid_email_address(x.strip())])
            if bcc:
                recipients.extend([x.strip() for x in bcc.split(',') if is_valid_email_address(x.strip())])

            server.sendmail(sender, recipients, msg.as_string())
            sent_count += 1
            log_lines.append(f"OK [{exam} -> {dest}]\n")

            rconn = sqlite3.connect(report_db)
            row = rconn.execute("SELECT 1 FROM report_student WHERE type=1 AND student=? AND copy=?", (exam, copy)).fetchone()
            if row:
                rconn.execute("""
                    UPDATE report_student
                    SET mail_status=1, mail_message='', mail_timestamp=?
                    WHERE type=1 AND student=? AND copy=?
                """, (now_ts, exam, copy))
            else:
                rconn.execute("""
                    INSERT INTO report_student (type, file, student, copy, timestamp, mail_status, mail_timestamp, mail_message)
                    VALUES (1, ?, ?, ?, ?, 1, ?, '')
                """, (target_pdf.name, exam, copy, now_ts, now_ts))
            rconn.commit()
            rconn.close()

        except smtplib.SMTPAuthenticationError as e:
            err_msg = e.smtp_error.decode('utf-8', errors='ignore') if isinstance(e.smtp_error, bytes) else str(e)
            failed_auth = True
            err = f"SMTP auth failed: {err_msg}"
            failures.append({"exam": exam, "id": val, "name": s_data.get('name', val), "email": dest, "error": err})
            failed_count += 1
            log_lines.append(f"FAILED auth [{exam} -> {dest}] {err}\n")
            break
        except Exception as e:
            err = str(e)
            failures.append({"exam": exam, "id": val, "name": s_data.get('name', val), "email": dest, "error": err})
            failed_count += 1
            log_lines.append(f"FAILED [{exam} -> {dest}] {err}\n")

            rconn = sqlite3.connect(report_db)
            row = rconn.execute("SELECT 1 FROM report_student WHERE type=1 AND student=? AND copy=?", (exam, copy)).fetchone()
            if row:
                rconn.execute("""
                    UPDATE report_student
                    SET mail_status=100, mail_message=?, mail_timestamp=?
                    WHERE type=1 AND student=? AND copy=?
                """, (err, now_ts, exam, copy))
            else:
                rconn.execute("""
                    INSERT INTO report_student (type, file, student, copy, timestamp, mail_status, mail_timestamp, mail_message)
                    VALUES (1, ?, ?, ?, ?, 100, ?, ?)
                """, (target_pdf.name, exam, copy, now_ts, now_ts, err))
            rconn.commit()
            rconn.close()

        if delay > 0:
            time.sleep(delay)

    if server:
        try:
            server.quit()
        except Exception:
            pass

    try:
        log_path = project.project_dir / 'mailing.log'
        with open(log_path, 'a', encoding='utf-8') as lf:
            lf.writelines(log_lines)
    except Exception as e:
        print(f"Error writing mailing.log: {e}")

    summary_msg = f"{sent_count} message(s) has been sent."
    if failed_count > 0:
        summary_msg += f" {failed_count} message(s) could not be sent."
    if failed_auth:
        summary_msg = f"SMTP authentication failed: check SMTP configuration and password. {summary_msg}"

    return {
        "success": failed_count == 0 and not failed_auth,
        "sent_count": sent_count,
        "failed_count": failed_count,
        "failed_auth": failed_auth,
        "message": summary_msg,
        "failures": failures
    }

def extract_student_subject_pdf(project: AMCProject, student: int, target_path: Path):
    """Slice pages belonging to student from DOC-sujet.pdf based on layout_page."""
    subject_pdf = project.project_dir / 'DOC-sujet.pdf'
    layout_db = project.data_dir / 'layout.sqlite'
    if not subject_pdf.exists() or not layout_db.exists():
        raise HTTPException(status_code=400, detail="DOC-sujet.pdf or layout data not found. Please compile documents first.")

    layout_conn = sqlite3.connect(layout_db)
    pages = layout_conn.execute("SELECT subjectpage FROM layout_page WHERE student=? ORDER BY page", (student,)).fetchall()
    layout_conn.close()

    if not pages:
        raise HTTPException(status_code=400, detail=f"No pages found for student copy {student} in layout.")

    doc = fitz.open(subject_pdf)
    output = fitz.open()
    for (page_number,) in pages:
        page_index = int(page_number) - 1
        if 0 <= page_index < len(doc):
            output.insert_pdf(doc, from_page=page_index, to_page=page_index)
    
    target_path.parent.mkdir(parents=True, exist_ok=True)
    output.save(target_path)
    output.close()
    doc.close()

@router.get("/{name}/preparation/mailing/preview")
def preview_prep_mailing(name: str, csv_file: Optional[str] = None, primary_key: Optional[str] = None):
    project = get_amc_project(name)
    settings = load_settings()
    sender_email = settings.get("email_sender", "").strip()

    # 1. Check sender email
    if not sender_email or not is_valid_email_address(sender_email):
        return {
            "status": "error",
            "code": "INVALID_SENDER_EMAIL",
            "message": "Bạn chưa điền email người gửi hoặc địa chỉ email không hợp lệ. Vui lòng vào Cài đặt (Preferences) -> tab Email để điền chính xác Email người gửi."
        }

    # 2. Check DOC-sujet.pdf & layout.sqlite
    subject_pdf = project.project_dir / 'DOC-sujet.pdf'
    layout_db = project.data_dir / 'layout.sqlite'
    if not subject_pdf.exists() or not layout_db.exists():
        return {
            "status": "error",
            "code": "NO_SUBJECT_PDF",
            "message": "Chưa tìm thấy file đề thi (DOC-sujet.pdf) hoặc dữ liệu bố cục bài thi. Vui lòng thực hiện cập nhật tài liệu (Update documents) và phát hiện bố cục (Layout detection) trước khi gửi đề thi."
        }

    # 3. Check CSV & email columns
    available_csvs = [f.name for f in project.project_dir.glob("*.csv") if f.is_file()]
    resolved_csv = csv_file
    if not resolved_csv or resolved_csv in ('null', 'undefined'):
        if "list.csv" in available_csvs:
            resolved_csv = "list.csv"
        elif available_csvs:
            resolved_csv = available_csvs[0]
        else:
            return {
                "status": "error",
                "code": "NO_CSV_FILE",
                "message": "Không tìm thấy file danh sách học sinh (.csv) nào trong thư mục dự án. Vui lòng tải lên file CSV danh sách học sinh ở tab Marking."
            }

    csv_path = get_project_file(project, resolved_csv, '.csv')
    if not csv_path.exists():
        return {
            "status": "error",
            "code": "NO_CSV_FILE",
            "message": f"Không tìm thấy file danh sách học sinh '{resolved_csv}' trong thư mục dự án."
        }

    with open(csv_path, 'r', encoding='utf-8-sig', newline='') as f:
        student_rows = list(csv.DictReader(f))

    if not student_rows:
        return {
            "status": "error",
            "code": "EMPTY_STUDENTS_LIST",
            "message": f"File danh sách học sinh '{resolved_csv}' đang trống."
        }

    email_cols, col_max = find_email_columns(student_rows)
    if not email_cols:
        return {
            "status": "error",
            "code": "NO_EMAIL_COLUMN",
            "message": "Không tìm thấy cột nào chứa địa chỉ email hợp lệ trong file danh sách học sinh. Vui lòng bổ sung cột email vào file CSV."
        }

    first_row_keys = list(student_rows[0].keys())
    resolved_pk = primary_key
    if not resolved_pk or resolved_pk in ('null', 'undefined') or resolved_pk not in first_row_keys:
        resolved_pk = 'id' if 'id' in first_row_keys else (first_row_keys[0] if first_row_keys else 'id')

    layout_conn = sqlite3.connect(layout_db)
    exam_students = [r[0] for r in layout_conn.execute("SELECT DISTINCT student FROM layout_page ORDER BY student").fetchall()]
    layout_assoc = dict(layout_conn.execute("SELECT student, id FROM layout_association").fetchall()) if layout_conn.execute("SELECT 1 FROM sqlite_master WHERE name='layout_association'").fetchone() else {}
    layout_conn.close()

    if not exam_students:
        return {
            "status": "error",
            "code": "NO_EXAM_STUDENTS",
            "message": "Không tìm thấy thông tin trang đề thi trong cơ sở dữ liệu layout. Vui lòng thực hiện cập nhật tài liệu (Update documents)."
        }

    # Read previous mailing status for REPORT_PRINTED_COPY (type = 3)
    report_db = project.data_dir / 'report.sqlite'
    mail_statuses = {}
    if report_db.exists():
        try:
            rconn = sqlite3.connect(report_db)
            rconn.row_factory = sqlite3.Row
            for row in rconn.execute('SELECT student, copy, file, mail_status, mail_message, mail_timestamp FROM report_student WHERE type=3'):
                mail_statuses[(row['student'], row['copy'])] = {
                    "file": row['file'],
                    "mail_status": row['mail_status'],
                    "mail_message": row['mail_message'] or "",
                    "mail_timestamp": row['mail_timestamp']
                }
            rconn.close()
        except Exception:
            pass

    students_by_pk = {r.get(resolved_pk, '').strip(): r for r in student_rows if r.get(resolved_pk, '').strip()}
    students_preview = []

    for idx, exam in enumerate(exam_students):
        s_data = None
        student_pk_val = ""
        if exam in layout_assoc and layout_assoc[exam] in students_by_pk:
            student_pk_val = layout_assoc[exam]
            s_data = students_by_pk[student_pk_val]
        elif idx < len(student_rows):
            s_data = student_rows[idx]
            student_pk_val = s_data.get(resolved_pk, str(exam))
        else:
            student_pk_val = str(exam)
            s_data = {resolved_pk: student_pk_val, "name": f"Student {exam}"}

        student_name = s_data.get('name', '')
        if s_data.get('forename'):
            student_name = f"{student_name} {s_data.get('forename')}".strip()
        if not student_name:
            student_name = student_pk_val

        registered_info = mail_statuses.get((exam, 0), {})
        status_code = registered_info.get("mail_status", 0)
        status_str = "done" if status_code == 1 else ("failed" if status_code == 100 else "")

        students_preview.append({
            "exam": exam,
            "copy": 0,
            "sc": str(exam),
            "id": student_pk_val,
            "name": student_name,
            "email": s_data.get(col_max, ''),
            "email_values": {c: str(s_data.get(c, '')) for c in email_cols},
            "status": status_str,
            "mail_message": registered_info.get("mail_message", ""),
            "has_pdf": True,
        })

    default_subject = settings.get("df_subjectemail_email_subject", "Exam question")
    default_body = settings.get("df_subjectemail_email_text", "Please find enclosed your question sheet.\nRegards.")
    exam_name = name

    available_files = []
    for f in project.project_dir.glob("*.pdf"):
        if not f.name.startswith("annotated-") and f.name != "DOC-sujet.pdf":
            available_files.append(f.name)

    return {
        "status": "ok",
        "mode": "subject",
        "project_name": name,
        "exam_name": exam_name,
        "csv_file": resolved_csv,
        "primary_key": resolved_pk,
        "available_csvs": available_csvs,
        "email_columns": email_cols,
        "default_email_col": col_max,
        "students": students_preview,
        "default_subject": default_subject,
        "default_body": default_body,
        "use_html": False,
        "sender": sender_email,
        "available_files": sorted(available_files),
    }

@router.post("/{name}/preparation/mailing/send")
def send_prep_mailing(name: str, req: MailingSendRequest):
    project = get_amc_project(name)
    settings = load_settings()

    host = settings.get("email_smtp_host", "smtp.gmail.com")
    port = int(settings.get("email_smtp_port", 465))
    security = settings.get("email_smtp_ssl", "SSL")
    user = settings.get("email_smtp_user", "")
    password = settings.get("email_smtp_password", "")
    sender = settings.get("email_sender", "") or user
    cc = settings.get("email_cc", "")
    bcc = settings.get("email_bcc", "")
    delay = max(0.0, float(settings.get("email_delay", 0.0)))

    if not sender or not is_valid_email_address(sender):
        raise HTTPException(status_code=400, detail="Sender email is not configured or invalid.")

    if not req.selected_exams:
        raise HTTPException(status_code=400, detail="No students were selected for mailing.")

    if req.subject:
        settings["df_subjectemail_email_subject"] = req.subject
    if req.body:
        settings["df_subjectemail_email_text"] = req.body
    save_settings(settings)

    available_csvs = [f.name for f in project.project_dir.glob("*.csv") if f.is_file()]
    resolved_csv = req.csv_file
    if not resolved_csv or resolved_csv in ('null', 'undefined'):
        if "list.csv" in available_csvs:
            resolved_csv = "list.csv"
        elif available_csvs:
            resolved_csv = available_csvs[0]
        else:
            raise HTTPException(status_code=400, detail="Không tìm thấy file CSV danh sách học sinh nào trong dự án.")

    csv_path = get_project_file(project, resolved_csv, '.csv')
    with open(csv_path, 'r', encoding='utf-8-sig', newline='') as f:
        student_rows = list(csv.DictReader(f))

    first_row_keys = list(student_rows[0].keys()) if student_rows else []
    resolved_pk = req.primary_key
    if not resolved_pk or resolved_pk in ('null', 'undefined') or resolved_pk not in first_row_keys:
        resolved_pk = 'id' if 'id' in first_row_keys else (first_row_keys[0] if first_row_keys else 'id')

    layout_db = project.data_dir / 'layout.sqlite'
    if not layout_db.exists():
        raise HTTPException(status_code=400, detail="Layout database not found")
    layout_conn = sqlite3.connect(layout_db)
    exam_students = [r[0] for r in layout_conn.execute("SELECT DISTINCT student FROM layout_page ORDER BY student").fetchall()]
    layout_assoc = dict(layout_conn.execute("SELECT student, id FROM layout_association").fetchall()) if layout_conn.execute("SELECT 1 FROM sqlite_master WHERE name='layout_association'").fetchone() else {}
    layout_conn.close()

    students_by_pk = {r.get(resolved_pk, '').strip(): r for r in student_rows if r.get(resolved_pk, '').strip()}
    student_map = {}
    for idx, exam in enumerate(exam_students):
        if exam in layout_assoc and layout_assoc[exam] in students_by_pk:
            student_map[exam] = (layout_assoc[exam], students_by_pk[layout_assoc[exam]])
        elif idx < len(student_rows):
            s = student_rows[idx]
            student_map[exam] = (s.get(resolved_pk, str(exam)), s)
        else:
            student_map[exam] = (str(exam), {resolved_pk: str(exam), "name": f"Student {exam}"})

    subject_dir = project.project_dir / "cr" / "subject"
    subject_dir.mkdir(parents=True, exist_ok=True)

    report_db = project.data_dir / 'report.sqlite'
    rconn = sqlite3.connect(report_db)
    rcur = rconn.cursor()
    rcur.execute("""
        CREATE TABLE IF NOT EXISTS report_student (
            type INTEGER, file TEXT, student INTEGER, copy INTEGER DEFAULT 0,
            timestamp INTEGER, mail_status INTEGER DEFAULT 0, mail_timestamp INTEGER DEFAULT 0,
            mail_message TEXT, PRIMARY KEY (type,student,copy)
        )
    """)
    rcur.execute("""
        CREATE TABLE IF NOT EXISTS report_directory (type INTEGER PRIMARY KEY, directory TEXT)
    """)
    rcur.execute("INSERT OR IGNORE INTO report_directory (type, directory) VALUES (3, 'cr/subject')")
    rconn.commit()
    rconn.close()

    extra_attachments = []
    for att_name in req.attachments:
        att_path = project.project_dir / att_name
        if att_path.exists() and att_path.is_file():
            try:
                data = att_path.read_bytes()
                extra_attachments.append((att_name, data))
            except Exception as e:
                print(f"Cannot read attachment {att_name}: {e}")

    server = None
    failed_auth = False
    try:
        if security == "SSL":
            server = smtplib.SMTP_SSL(host, port, timeout=20)
        else:
            server = smtplib.SMTP(host, port, timeout=20)
            if security == "STARTTLS":
                server.starttls()
        if user and password:
            server.login(user, password)
    except smtplib.SMTPAuthenticationError as e:
        err_msg = e.smtp_error.decode('utf-8', errors='ignore') if isinstance(e.smtp_error, bytes) else str(e)
        return {
            "success": False,
            "sent_count": 0,
            "failed_count": len(req.selected_exams),
            "failed_auth": True,
            "message": f"SMTP authentication failed: check SMTP configuration and password. ({err_msg})",
            "failures": [{"exam": exam, "error": f"Auth failed: {err_msg}"} for exam in req.selected_exams]
        }
    except Exception as e:
        return {
            "success": False,
            "sent_count": 0,
            "failed_count": len(req.selected_exams),
            "failed_auth": False,
            "message": f"Cannot connect to SMTP server: {str(e)}",
            "failures": [{"exam": exam, "error": str(e)} for exam in req.selected_exams]
        }

    sent_count = 0
    failed_count = 0
    failures = []
    log_lines = [f"{time.ctime()} Starting subject mailing for project {name}...\n"]

    for exam in req.selected_exams:
        if exam not in student_map:
            continue
        val, s_data = student_map[exam]
        dest = str(s_data.get(req.email_col, '')).strip()
        now_ts = int(time.time())

        if not dest or not is_valid_email_address(dest):
            err = f"Invalid or empty email: '{dest}'"
            failures.append({"exam": exam, "id": val, "name": s_data.get('name', val), "email": dest, "error": err})
            failed_count += 1
            log_lines.append(f"FAILED [{exam} -> {dest}] {err}\n")
            rconn = sqlite3.connect(report_db)
            rconn.execute("""
                UPDATE report_student
                SET mail_status=100, mail_message=?, mail_timestamp=?
                WHERE type=3 AND student=? AND copy=0
            """, (err, now_ts, exam))
            rconn.commit()
            rconn.close()
            continue

        target_pdf = subject_dir / f"subject-{exam}.pdf"
        try:
            extract_student_subject_pdf(project, exam, target_pdf)
        except Exception as e:
            err = f"Failed to extract question pages: {e}"
            failures.append({"exam": exam, "id": val, "name": s_data.get('name', val), "email": dest, "error": err})
            failed_count += 1
            log_lines.append(f"FAILED [{exam} -> {dest}] {err}\n")
            rconn = sqlite3.connect(report_db)
            rconn.execute("""
                UPDATE report_student
                SET mail_status=100, mail_message=?, mail_timestamp=?
                WHERE type=3 AND student=? AND copy=0
            """, (err, now_ts, exam))
            rconn.commit()
            rconn.close()
            continue

        sub_subject = substitute_email_message(req.subject, s_data, req.exam_name, {})
        sub_body = substitute_email_message(req.body, s_data, req.exam_name, {})

        msg = MIMEMultipart()
        msg['From'] = sender
        msg['To'] = dest
        if cc:
            msg['Cc'] = cc
        msg['Subject'] = sub_subject
        msg['User-Agent'] = "AutoMultipleChoice/AMC-WEB"
        msg['X-Project'] = name
        msg['X-AMC-Student'] = str(exam)

        body_type = 'html' if req.use_html else 'plain'
        msg.attach(MIMEText(sub_body, body_type, 'utf-8'))

        try:
            pdf_bytes = target_pdf.read_bytes()
            part = MIMEApplication(pdf_bytes, Name="subject.pdf")
            part['Content-Disposition'] = 'attachment; filename="subject.pdf"'
            msg.attach(part)
        except Exception as e:
            err = f"Failed to read subject PDF: {e}"
            failures.append({"exam": exam, "id": val, "name": s_data.get('name', val), "email": dest, "error": err})
            failed_count += 1
            log_lines.append(f"FAILED [{exam} -> {dest}] {err}\n")
            continue

        for att_name, att_bytes in extra_attachments:
            try:
                extra_part = MIMEApplication(att_bytes, Name=att_name)
                extra_part['Content-Disposition'] = f'attachment; filename="{att_name}"'
                msg.attach(extra_part)
            except Exception:
                pass

        try:
            recipients = [dest]
            if cc:
                recipients.extend([x.strip() for x in cc.split(',') if is_valid_email_address(x.strip())])
            if bcc:
                recipients.extend([x.strip() for x in bcc.split(',') if is_valid_email_address(x.strip())])

            server.sendmail(sender, recipients, msg.as_string())
            sent_count += 1
            log_lines.append(f"OK [{exam} -> {dest}]\n")

            rconn = sqlite3.connect(report_db)
            row = rconn.execute("SELECT 1 FROM report_student WHERE type=3 AND student=? AND copy=0", (exam,)).fetchone()
            if row:
                rconn.execute("""
                    UPDATE report_student
                    SET mail_status=1, mail_message='', mail_timestamp=?
                    WHERE type=3 AND student=? AND copy=0
                """, (now_ts, exam))
            else:
                rconn.execute("""
                    INSERT INTO report_student (type, file, student, copy, timestamp, mail_status, mail_timestamp, mail_message)
                    VALUES (3, ?, ?, 0, ?, 1, ?, '')
                """, (target_pdf.name, exam, now_ts, now_ts))
            rconn.commit()
            rconn.close()

        except smtplib.SMTPAuthenticationError as e:
            err_msg = e.smtp_error.decode('utf-8', errors='ignore') if isinstance(e.smtp_error, bytes) else str(e)
            failed_auth = True
            err = f"SMTP auth failed: {err_msg}"
            failures.append({"exam": exam, "id": val, "name": s_data.get('name', val), "email": dest, "error": err})
            failed_count += 1
            log_lines.append(f"FAILED auth [{exam} -> {dest}] {err}\n")
            break
        except Exception as e:
            err = str(e)
            failures.append({"exam": exam, "id": val, "name": s_data.get('name', val), "email": dest, "error": err})
            failed_count += 1
            log_lines.append(f"FAILED [{exam} -> {dest}] {err}\n")

            rconn = sqlite3.connect(report_db)
            row = rconn.execute("SELECT 1 FROM report_student WHERE type=3 AND student=? AND copy=0", (exam,)).fetchone()
            if row:
                rconn.execute("""
                    UPDATE report_student
                    SET mail_status=100, mail_message=?, mail_timestamp=?
                    WHERE type=3 AND student=? AND copy=0
                """, (err, now_ts, exam))
            else:
                rconn.execute("""
                    INSERT INTO report_student (type, file, student, copy, timestamp, mail_status, mail_timestamp, mail_message)
                    VALUES (3, ?, ?, 0, ?, 100, ?, ?)
                """, (target_pdf.name, exam, now_ts, now_ts, err))
            rconn.commit()
            rconn.close()

        if delay > 0:
            time.sleep(delay)

    if server:
        try:
            server.quit()
        except Exception:
            pass

    try:
        log_path = project.project_dir / 'mailing.log'
        with open(log_path, 'a', encoding='utf-8') as lf:
            lf.writelines(log_lines)
    except Exception as e:
        print(f"Error writing mailing.log: {e}")

    summary_msg = f"{sent_count} message(s) has been sent."
    if failed_count > 0:
        summary_msg += f" {failed_count} message(s) could not be sent."
    if failed_auth:
        summary_msg = f"SMTP authentication failed: check SMTP configuration and password. {summary_msg}"

    return {
        "success": failed_count == 0 and not failed_auth,
        "sent_count": sent_count,
        "failed_count": failed_count,
        "failed_auth": failed_auth,
        "message": summary_msg,
        "failures": failures
    }

@router.post("/{name}/edit_csv")
def edit_csv_file(name: str, payload: EditCsvRequest):
    amc_proj = get_amc_project(name)
    csv_path = get_project_file(amc_proj, payload.filename, '.csv')
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="CSV file not found")
    try:
        # Mở notepad mà không chặn tiến trình backend
        if os.name != "nt":
            raise HTTPException(status_code=501, detail="Notepad editing requires the backend to run on Windows.")
        subprocess.Popen(
            ["notepad.exe", str(csv_path)],
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS,
        )
        return {"message": "Notepad opened successfully."}
    except HTTPException:
        raise
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="notepad.exe was not found on this computer.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{name}/upload_csv")
async def upload_csv_file(name: str, file: UploadFile = File(...)):
    amc_proj = get_amc_project(name)
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed.")
    
    target_path = get_project_file(amc_proj, file.filename, '.csv')
    try:
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"message": f"Successfully uploaded {file.filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{name}/manual_association")
def get_manual_association(name: str, file: str, primary_key: str):
    """Return scanned name fields, CSV values, and saved manual assignments."""
    amc_proj = get_amc_project(name)
    csv_path = get_project_file(amc_proj, file, '.csv')
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="CSV file not found")

    try:
        with open(csv_path, 'r', encoding='utf-8-sig', newline='') as csv_file:
            reader = csv.DictReader(csv_file)
            if not reader.fieldnames or primary_key not in reader.fieldnames:
                raise HTTPException(status_code=400, detail="Primary key was not found in the CSV file")
            values = [row[primary_key].strip() for row in reader if row.get(primary_key, '').strip()]

        db_path = amc_proj.data_dir / 'capture.sqlite'
        if not db_path.exists():
            return {"values": values, "papers": []}

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        cur.execute('''
            CREATE TABLE IF NOT EXISTS manual_association (
                student INTEGER NOT NULL,
                page INTEGER NOT NULL,
                copy INTEGER NOT NULL DEFAULT 0,
                primary_key TEXT NOT NULL,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (student, page, copy, primary_key)
            )
        ''')
        cur.execute('''
            SELECT p.student, p.page, p.copy, z.image AS name_image, m.value AS manual
            FROM capture_zone z
            JOIN capture_page p
              ON p.student = z.student AND p.page = z.page AND p.copy = z.copy
            LEFT JOIN manual_association m
             ON m.student = p.student AND m.page = p.page AND m.copy = p.copy
             AND m.primary_key = ?
            WHERE z.type = 2 AND z.image IS NOT NULL
            ORDER BY p.student, p.copy, p.page
        ''', (primary_key,))
        papers = [dict(row) for row in cur.fetchall()]
        conn.commit()
        conn.close()
        return {"values": values, "papers": papers}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{name}/identification_status")
def get_identification_status(name: str, primary_key: str):
    """Count sheets still unmatched after automatic and manual association."""
    amc_proj = get_amc_project(name)
    try:
        status = get_association_status(amc_proj, primary_key)
        return {key: status[key] for key in ("total", "matched", "missing", "automatic", "automatic_run")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{name}/manual_namefield")
def get_manual_namefield(name: str, student: int, page: Optional[int] = None, copy: int = 0):
    amc_proj = get_amc_project(name)
    db_path = amc_proj.data_dir / 'capture.sqlite'
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Capture data not found")
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        if page is not None:
            cur.execute('''
                SELECT image FROM capture_zone
                WHERE student=? AND page=? AND copy=? AND type=2 AND image IS NOT NULL
                LIMIT 1
            ''', (student, page, copy))
        else:
            cur.execute('''
                SELECT image FROM capture_zone
                WHERE student=? AND copy=? AND type=2 AND image IS NOT NULL
                ORDER BY page ASC
                LIMIT 1
            ''', (student, copy))
        row = cur.fetchone()
        conn.close()
        if not row:
            raise HTTPException(status_code=404, detail="Name field image not found")
        image_path = (amc_proj.cr_dir / row[0]).resolve()
        if image_path.parent != amc_proj.cr_dir.resolve() or not image_path.exists():
            raise HTTPException(status_code=404, detail="Name field image not found")
        return FileResponse(image_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{name}/manual_association")
def update_manual_association(name: str, update: ManualAssociationUpdate):
    amc_proj = get_amc_project(name)
    db_path = amc_proj.data_dir / 'capture.sqlite'
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Capture data not found")
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute('''
            CREATE TABLE IF NOT EXISTS manual_association (
                student INTEGER NOT NULL, page INTEGER NOT NULL, copy INTEGER NOT NULL DEFAULT 0,
                primary_key TEXT NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL,
                PRIMARY KEY (student, page, copy, primary_key)
            )
        ''')
        if update.value is None:
            cur.execute('''
                DELETE FROM manual_association
                WHERE student=? AND page=? AND copy=? AND primary_key=?
            ''', (update.student, update.page, update.copy, update.primary_key))
        else:
            cur.execute('''
            INSERT INTO manual_association (student, page, copy, primary_key, value, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(student, page, copy, primary_key) DO UPDATE SET
                value=excluded.value, updated_at=excluded.updated_at
            ''', (update.student, update.page, update.copy, update.primary_key, update.value, int(time.time())))
        conn.commit()
        conn.close()
        return {"message": "Manual association saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SourceUpdate(BaseModel):
    content: str
    format: str | None = None

@router.get("/{name}/source")
def get_project_source(name: str, format: str = None):
    try:
        project_dir = PROJECTS_ROOT / name
        if not project_dir.exists():
            raise HTTPException(status_code=404, detail="Project not found")
            
        source_file_tex = project_dir / f"{name}.tex"
        source_file_txt = project_dir / f"{name}.txt"
        
        if format == 'txt' and source_file_txt.exists():
            read_file = source_file_txt
        elif format == 'latex' and source_file_tex.exists():
            read_file = source_file_tex
        else:
            read_file = source_file_txt if source_file_txt.exists() else source_file_tex
            
        if not read_file.exists():
            return {"content": "", "format": format or "latex"}
            
        with open(read_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        res_format = format if format else ("txt" if read_file.suffix == '.txt' else "latex")
        return {"content": content, "format": res_format}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{name}/source")
def update_project_source(name: str, source: SourceUpdate):
    try:
        project_dir = PROJECTS_ROOT / name
        if not project_dir.exists():
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Determine target format from request, or auto-detect from existing files
        target_format = source.format
        if not target_format:
            target_format = 'txt' if (project_dir / f"{name}.txt").exists() else 'latex'
        
        if target_format == 'txt':
            source_file = project_dir / f"{name}.txt"
            other_file = project_dir / f"{name}.tex"
        else:
            source_file = project_dir / f"{name}.tex"
            other_file = project_dir / f"{name}.txt"
            
        with open(source_file, 'w', encoding='utf-8') as f:
            f.write(source.content)
        
        # Remove the other format file if it exists to avoid confusion
        if other_file.exists():
            other_file.unlink()
            
        return {"message": "Source updated successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CopiesUpdate(BaseModel):
    copies: int

@router.get("/{name}/copies")
def get_project_copies(name: str):
    try:
        source_file_tex = PROJECTS_ROOT / name / f"{name}.tex"
        source_file_txt = PROJECTS_ROOT / name / f"{name}.txt"
        source_file = source_file_txt if source_file_txt.exists() else source_file_tex

        if not source_file.exists():
            return {"copies": 0}
            
        with open(source_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        match = re.search(r'\\onecopy\{(\d+)\}', content)
        if match:
            return {"copies": int(match.group(1))}
        return {"copies": 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{name}/copies")
def update_project_copies(name: str, update: CopiesUpdate):
    try:
        source_file_tex = PROJECTS_ROOT / name / f"{name}.tex"
        source_file_txt = PROJECTS_ROOT / name / f"{name}.txt"
        source_file = source_file_txt if source_file_txt.exists() else source_file_tex

        if not source_file.exists():
            raise HTTPException(status_code=404, detail="Project not found")
            
        with open(source_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Replace \onecopy{X} with \onecopy{Y}
        if re.search(r'\\onecopy\{\d+\}', content):
            new_content = re.sub(r'\\onecopy\{\d+\}', f'\\\\onecopy{{{update.copies}}}', content)
        else:
            # If not found, we could append it or just ignore. We'll just ignore for now if it doesn't exist.
            new_content = content
            
        with open(source_file, 'w', encoding='utf-8') as f:
            f.write(new_content)
            
        return {"message": "Copies updated", "copies": update.copies}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{name}/anonymize")
def anonymize_project(name: str):
    try:
        amc_proj = AMCProject(base_path=str(PROJECTS_ROOT), project_name=name)
        settings = load_settings()
        amc_proj.anonymize(settings)
        return {"success": True, "message": "Anonymized PDFs generated successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{name}/anonymous_documents")
def download_anonymous_documents(name: str):
    import zipfile
    import tempfile
    try:
        amc_proj = AMCProject(base_path=str(PROJECTS_ROOT), project_name=name)
        anon_dir = amc_proj.anonymous_dir
        if not anon_dir.exists() or not any(anon_dir.iterdir()):
            raise HTTPException(status_code=404, detail="No anonymized documents found.")
            
        # Create a temporary zip file
        temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
        with zipfile.ZipFile(temp_zip.name, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for pdf_file in anon_dir.glob("*.pdf"):
                zipf.write(pdf_file, pdf_file.name)
        
        return FileResponse(
            temp_zip.name,
            media_type="application/zip",
            filename=f"{name}_anonymous.zip",
            background=BackgroundTask(lambda: os.unlink(temp_zip.name))
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{name}/prepare")
def prepare_project(name: str):
    try:
        amc_proj = AMCProject(base_path=str(PROJECTS_ROOT), project_name=name)
        source_file_tex = amc_proj.project_dir / f"{name}.tex"
        source_file_txt = amc_proj.project_dir / f"{name}.txt"
        source_file = source_file_txt if source_file_txt.exists() else source_file_tex
        
        amc_proj.prepare(str(source_file))
        
        # Kiểm tra xem file có thực sự được sinh ra không
        sujet_path = amc_proj.project_dir / "DOC-sujet.pdf"
        if not sujet_path.exists():
            raise HTTPException(status_code=500, detail="AMC-prepare failed to generate PDF. Check LaTeX syntax or AMC installation.")
                
        return {"message": "Documents updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{name}/compile_log")
def compile_project_with_log(name: str):
    try:
        amc_proj = AMCProject(base_path=str(PROJECTS_ROOT), project_name=name)
        source_file_tex = amc_proj.project_dir / f"{name}.tex"
        source_file_txt = amc_proj.project_dir / f"{name}.txt"
        source_file = source_file_txt if source_file_txt.exists() else source_file_tex
        
        result = amc_proj.compile_with_log(str(source_file))

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{name}/layout_detection")
def layout_detection(name: str):
    try:
        amc_proj = AMCProject(base_path=str(PROJECTS_ROOT), project_name=name)
        amc_proj.meptex()
        
        # Verify layout.sqlite was populated
        db_path = amc_proj.data_dir / "layout.sqlite"
        if not db_path.exists():
            raise HTTPException(status_code=500, detail="layout.sqlite was not created.")
            
        conn = sqlite3.connect(str(db_path))
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM layout_page")
        pages = cur.fetchone()[0]
        conn.close()
        
        layout_pdf = amc_proj.project_dir / "DOC-layout.pdf"
        if layout_pdf.exists():
            layout_pdf.unlink()
            
        return {"message": "Layout detection completed", "pages": pages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def generate_layout_pdf(project_dir: Path):
    sujet_path = project_dir / "DOC-sujet.pdf"
    db_path = project_dir / "data" / "layout.sqlite"
    out_path = project_dir / "DOC-layout.pdf"
    
    if not sujet_path.exists() or not db_path.exists():
        return False
        
    try:
        doc = fitz.open(str(sujet_path))
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        # Draw Namefield (Blue)
        try:
            cur.execute("SELECT student, page, xmin, xmax, ymin, ymax FROM layout_namefield")
            for row in cur.fetchall():
                # AMC pages are 1-indexed for 'student' and 'page'? Wait, AMC 'page' is usually 1-indexed.
                # PyMuPDF pages are 0-indexed. But AMC actually creates a single PDF with all students.
                # We need to map student/page to the absolute page number in the PDF.
                # Actually, layout_page table contains (student, page, subjectpage).
                # subjectpage is the absolute page index (1-indexed).
                pass
        except Exception:
            pass # ignore if table doesn't exist
            
        # Join with layout_page to get absolute page number and DPI for boxes
        try:
            query_box = '''
                SELECT p.subjectpage, p.dpi, b.xmin, b.xmax, b.ymin, b.ymax
                FROM layout_box b
                JOIN layout_page p ON b.student = p.student AND b.page = p.page
            '''
            cur.execute(query_box)
            for row in cur.fetchall():
                subjectpage = int(row['subjectpage']) - 1 # 0-indexed
                dpi = float(row['dpi'])
                scale = 72.0 / dpi
                if 0 <= subjectpage < len(doc):
                    page = doc[subjectpage]
                    rect = fitz.Rect(
                        row['xmin'] * scale, 
                        row['ymin'] * scale, 
                        row['xmax'] * scale, 
                        row['ymax'] * scale
                    )
                    page.draw_rect(rect, color=(1, 0, 0), width=1) # Red box
        except Exception as e:
            print("Error drawing box layout:", e)
                    
        # Join with layout_page for namefield from layout_zone
        try:
            query_name = '''
                SELECT p.subjectpage, p.dpi, z.xmin, z.xmax, z.ymin, z.ymax
                FROM layout_zone z
                JOIN layout_page p ON z.student = p.student AND z.page = p.page
                WHERE z.zone = '__n'
            '''
            cur.execute(query_name)
            for row in cur.fetchall():
                subjectpage = int(row['subjectpage']) - 1
                dpi = float(row['dpi'])
                scale = 72.0 / dpi
                if 0 <= subjectpage < len(doc):
                    page = doc[subjectpage]
                    rect = fitz.Rect(
                        row['xmin'] * scale, 
                        row['ymin'] * scale, 
                        row['xmax'] * scale, 
                        row['ymax'] * scale
                    )
                    page.draw_rect(rect, color=(0, 0, 1), width=1.5) # Blue box
        except Exception as e:
            print("Error drawing namefield layout (or table missing):", e)
            
        # Join with layout_page for digits (ID block)
        try:
            query_digit = '''
                SELECT p.subjectpage, p.dpi, d.xmin, d.xmax, d.ymin, d.ymax
                FROM layout_digit d
                JOIN layout_page p ON d.student = p.student AND d.page = p.page
            '''
            cur.execute(query_digit)
            for row in cur.fetchall():
                subjectpage = int(row['subjectpage']) - 1
                dpi = float(row['dpi'])
                scale = 72.0 / dpi
                if 0 <= subjectpage < len(doc):
                    page = doc[subjectpage]
                    rect = fitz.Rect(
                        row['xmin'] * scale, 
                        row['ymin'] * scale, 
                        row['xmax'] * scale, 
                        row['ymax'] * scale
                    )
                    page.draw_rect(rect, color=(0, 0.5, 0), width=1) # Green box
        except Exception as e:
            print("Error drawing digit layout (or table missing):", e)
            
        conn.close()
        doc.save(str(out_path))
        return True
    except Exception as e:
        print("Failed to generate layout PDF:", e)
        return False

@router.get("/{name}/pdf/{pdf_type}")
def download_pdf(name: str, pdf_type: str):
    project_dir = PROJECTS_ROOT / name
    if pdf_type == "sujet":
        file_path = project_dir / "DOC-sujet.pdf"
    elif pdf_type == "corrige":
        file_path = project_dir / "DOC-corrige.pdf"
    elif pdf_type == "indiv_solution":
        file_path = project_dir / "DOC-indiv-solution.pdf"
    elif pdf_type == "layout":
        file_path = project_dir / "DOC-layout.pdf"
        if not file_path.exists():
            success = generate_layout_pdf(project_dir)
            if not success:
                raise HTTPException(status_code=404, detail="Layout detection data not found. Please click Layout Detection first.")
    else:
        raise HTTPException(status_code=400, detail="Invalid pdf type")
        
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="PDF not found. Please click Update documents first.")
        
    return FileResponse(
        path=file_path, 
        filename=file_path.name, 
        media_type='application/pdf',
        headers={"Content-Disposition": f'attachment; filename="{file_path.name}"'}
    )

@router.post("/{name}/capture")
async def capture_scans(name: str, files: List[UploadFile] = File(...)):
    project_dir = PROJECTS_ROOT / name
    if not project_dir.exists():
        raise HTTPException(status_code=404, detail="Project not found")

    scans_dir = project_dir / "scans"
    scans_dir.mkdir(exist_ok=True)
    
    # Save uploaded files
    for file in files:
        # Clean up any existing PNGs or PDFs in scans with the same base name
        base_name = os.path.splitext(file.filename)[0]
        for existing in scans_dir.glob(f"{base_name}*"):
            try:
                existing.unlink()
            except Exception:
                pass
                
        file_path = scans_dir / file.filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # If it's a PDF, extract to PNG using pdftoppm (poppler)
        if file.filename.lower().endswith('.pdf'):
            try:
                import subprocess
                prefix = str(scans_dir / f"{file.filename}_page")
                capture_dpi = str(int(load_settings()["capture_dpi"]))
                subprocess.run(['pdftoppm', '-png', '-r', capture_dpi, str(file_path), prefix], check=True)
                os.remove(file_path) # Delete PDF so AMC analyse doesn't choke on it
            except Exception as e:
                print("Error extracting PDF with pdftoppm:", e)

    # Run AMC analyse
    scan_settings = load_settings()
    amc_proj = AMCProject(str(PROJECTS_ROOT), name)
    try:
        amc_proj.analyse(scan_settings)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analyse failed: {str(e)}")

    return {"message": "Capture successful"}

@router.get("/{name}/capture_data")
def get_capture_data(name: str, code_name: Optional[str] = None):
    project_dir = PROJECTS_ROOT / name
    db_path = project_dir / "data" / "capture.sqlite"
    if not db_path.exists():
        return {"data": []}

    try:
        settings = load_settings()
        limit_mse = float(settings["limit_mse"])
        limit_sensitivity = float(settings["limit_sensitivity"])
        project = get_amc_project(name)
        declarations = get_amc_code_declarations(project)
        active_code = code_name if code_name in declarations else next(iter(declarations), None)
        decoded_codes = {}
        scoring_path = project.data_dir / 'scoring.sqlite'
        if active_code and scoring_path.exists():
            score_conn = sqlite3.connect(scoring_path)
            try:
                decoded_codes = {
                    (student, copy): value
                    for student, copy, value in score_conn.execute(
                        'SELECT student, copy, value FROM scoring_code WHERE code=?', (active_code,)
                    )
                }
            except sqlite3.Error:
                pass
            score_conn.close()

        code_question_ids = set()
        if active_code and scoring_path.exists():
            score_conn = sqlite3.connect(scoring_path)
            try:
                title_pattern = re.compile(rf'^{re.escape(active_code)}(?:\[(\d+)\]|\.(\d+))$')
                for question, title in score_conn.execute('SELECT question, title FROM scoring_title'):
                    if title_pattern.match(title or ''):
                        code_question_ids.add(question)
            except sqlite3.Error:
                pass
            score_conn.close()
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        cur.execute("SELECT student, page, copy, mse, src, timestamp_auto FROM capture_page ORDER BY student, page, copy")
        pages = cur.fetchall()

        cur.execute("SELECT student, page, copy, black, total FROM capture_zone WHERE type IN (3,4) AND total > 0")
        zones = cur.fetchall()

        invalid_code_pages = set()
        if code_question_ids:
            placeholders = ','.join('?' for _ in code_question_ids)
            code_zones = cur.execute(
                f'''SELECT student, page, copy, id_a, black, total FROM capture_zone
                    WHERE type=4 AND id_a IN ({placeholders})''', tuple(code_question_ids)
            ).fetchall()
            code_marks = {}
            darkness_threshold = float(settings['default_darkness_threshold'])
            for zone in code_zones:
                page_key = (zone['student'], zone['page'], zone['copy'])
                question_marks = code_marks.setdefault(page_key, {}).setdefault(zone['id_a'], 0)
                if zone['total'] and float(zone['black']) / float(zone['total']) >= darkness_threshold:
                    code_marks[page_key][zone['id_a']] = question_marks + 1
            for page_key, question_counts in code_marks.items():
                if any(count != 1 for count in question_counts.values()) or set(question_counts) != code_question_ids:
                    invalid_code_pages.add(page_key)
        
        zone_dict = {}
        for z in zones:
            key = (z['student'], z['page'], z['copy'])
            if key not in zone_dict:
                zone_dict[key] = []
            ratio = float(z['black']) / float(z['total'])
            zone_dict[key].append(ratio)
            
        data = []
        for p in pages:
            key = (p['student'], p['page'], p['copy'])
            identifier = f"{p['student']}/{p['page']}"
            if p['copy'] > 0:
                identifier += f":{p['copy']}"
                
            mse = round(p['mse'], 2) if p['mse'] is not None else 0.0
            
            sens_val = "---"
            if key in zone_dict and zone_dict[key]:
                ratios = zone_dict[key]
                min_dist = min([abs(r - 0.15) for r in ratios])
                # Simple approximation for sensitivity display
                sens = round(min_dist * 10, 1)
                sens_val = str(sens)
                
            data.append({
                "identifier": identifier,
                "mse": mse,
                "sensitivity": sens_val,
                "mse_warning": mse > limit_mse,
                "sensitivity_warning": sens_val != "---" and float(sens_val) >= limit_sensitivity,
                "updated": __import__('datetime').datetime.fromtimestamp(p['timestamp_auto']).strftime('%m/%d/%y %H:%M:%S') if p['timestamp_auto'] else '',
                "scan_file": __import__('os').path.basename(p['src']) if p['src'] else '',
                "code_name": active_code,
                "code_value": decoded_codes.get((p['student'], p['copy']), ''),
                "code_invalid": bool(active_code) and (
                    key in invalid_code_pages
                    or (
                        (p['student'], p['copy']) in decoded_codes and (
                            not decoded_codes[(p['student'], p['copy'])].isdigit()
                            or len(decoded_codes[(p['student'], p['copy'])]) != declarations[active_code]
                        )
                    )
                ),
            })
            
        failed_scans = []
        try:
            failed_scans = [row[0] for row in cur.execute('SELECT filename FROM capture_failed ORDER BY timestamp DESC')]
        except sqlite3.Error:
            pass
        conn.close()
        return {"data": data, "failed_scans": failed_scans, "limit_mse": limit_mse, "limit_sensitivity": limit_sensitivity}
    except Exception as e:
        print("Error reading capture data:", e)
        return {"data": []}

@router.get("/{name}/capture_zooms")
def get_capture_zooms(name: str, student: int, page: int, copy: int = 0):
    project_dir = PROJECTS_ROOT / name
    db_path = project_dir / "data" / "capture.sqlite"
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Capture data not found")

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        settings = load_settings()
        threshold = float(settings.get("default_darkness_threshold", 0.15))

        cur.execute('''
            SELECT id_a, id_b, total, black, imagedata, type, manual
            FROM capture_zone
            WHERE student=? AND page=? AND copy=? AND type=4 AND imagedata IS NOT NULL
        ''', (student, page, copy))
        
        boxes = []
        for row in cur.fetchall():
            total = float(row['total'])
            black = float(row['black'])
            ratio = black / total if total > 0 else 0.0
            manual = row['manual'] if 'manual' in row.keys() and row['manual'] is not None else -1.0
            if manual >= 0:
                checked = manual > 0
            else:
                checked = ratio >= threshold
            
            image_b64 = ""
            if row['imagedata']:
                image_b64 = base64.b64encode(row['imagedata']).decode('utf-8')
                
            boxes.append({
                "id_a": row['id_a'],
                "id_b": row['id_b'],
                "ratio": round(ratio, 3),
                "checked": checked,
                "image": image_b64
            })
            
        conn.close()
        return {"boxes": boxes}
    except Exception as e:
        print("Error reading zooms:", e)
        raise HTTPException(status_code=500, detail="Database error")

@router.get("/{name}/unrecognized_scans")
def get_unrecognized_scans(name: str):
    amc_proj = get_amc_project(name)
    db_path = amc_proj.data_dir / "capture.sqlite"
    if not db_path.exists():
        return {"scans": []}

    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT filename, timestamp FROM capture_failed ORDER BY timestamp DESC")
        rows = cur.fetchall()
        conn.close()

        diag_dir = amc_proj.cr_dir / "diagnostic"
        scans = []
        for filename, ts in rows:
            scan_name = Path(filename).name if filename else ""
            date_str = datetime.datetime.fromtimestamp(ts).strftime('%m/%d/%y %H:%M:%S') if ts else ""
            has_preprocessed = False
            if diag_dir.exists() and scan_name:
                has_preprocessed = any(f.name.startswith(scan_name) for f in diag_dir.glob("*.png"))
            scans.append({
                "filename": filename,
                "scan": scan_name,
                "date": date_str,
                "timestamp": ts,
                "has_preprocessed": has_preprocessed
            })
        return {"scans": scans}
    except Exception as e:
        print("Error reading unrecognized scans:", e)
        return {"scans": []}

@router.get("/{name}/unrecognized_scan_image")
def get_unrecognized_scan_image(name: str, filename: str):
    amc_proj = get_amc_project(name)
    clean_name = Path(filename).name
    target_file = amc_proj.scans_dir / clean_name
    if not target_file.exists():
        if "%PROJET" in filename:
            rel = filename.replace("%PROJET/", "").replace("%PROJET\\", "")
            target_file = amc_proj.project_dir / rel
        if not target_file.exists():
            raise HTTPException(status_code=404, detail="Scan file not found")
    
    return FileResponse(str(target_file))

@router.post("/{name}/unrecognized_scan_preprocess")
def preprocess_unrecognized_scan(name: str, filename: str):
    amc_proj = get_amc_project(name)
    settings = load_settings()
    try:
        diag_file = amc_proj.analyse_diagnostic(filename, scan_options=settings)
        return {"success": True, "diagnostic_file": diag_file.name}
    except Exception as e:
        print("Error in preprocess_unrecognized_scan:", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{name}/unrecognized_diagnostic_image")
def get_unrecognized_diagnostic_image(name: str, filename: str):
    amc_proj = get_amc_project(name)
    clean_name = Path(filename).name
    diag_dir = amc_proj.cr_dir / "diagnostic"
    if not diag_dir.exists():
        raise HTTPException(status_code=404, detail="Diagnostic directory not found")
    
    matches = list(diag_dir.glob(f"{clean_name}*"))
    if not matches:
        matches = [f for f in diag_dir.glob("*.png") if clean_name in f.name]
        if not matches:
            raise HTTPException(status_code=404, detail="Diagnostic image not found")
    
    return FileResponse(str(matches[0]))

@router.delete("/{name}/unrecognized_scan")
def delete_unrecognized_scan(name: str, filename: str):
    amc_proj = get_amc_project(name)
    db_path = amc_proj.data_dir / "capture.sqlite"
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Database not found")

    # 1. Delete physical scan file if exists
    clean_name = Path(filename).name
    target_file = amc_proj.scans_dir / clean_name
    if target_file.exists():
        try:
            target_file.unlink()
        except Exception as e:
            print(f"Warning: could not delete physical scan file {target_file}: {e}")

    # 2. Delete diagnostic image if exists
    diag_dir = amc_proj.cr_dir / "diagnostic"
    if diag_dir.exists():
        for diag_f in diag_dir.glob(f"{clean_name}*"):
            try:
                diag_f.unlink()
            except Exception as e:
                print(f"Warning: could not delete diagnostic file {diag_f}: {e}")

    # 3. Delete record from capture_failed
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("DELETE FROM capture_failed WHERE filename=? OR filename LIKE ?", 
                    (filename, f"%{clean_name}%"))
        conn.commit()
        conn.close()
        return {"message": "Scan deleted successfully"}
    except Exception as e:
        print("Error deleting unrecognized scan:", e)
        raise HTTPException(status_code=500, detail="Database error while deleting scan")

@router.get("/{name}/capture_layout")
def get_capture_layout(name: str, student: int, page: int, copy: int = 0):
    project_dir = PROJECTS_ROOT / name
    db_path = project_dir / "data" / "capture.sqlite"
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Capture data not found")

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        cur.execute('''
            SELECT layout_image FROM capture_page
            WHERE student=? AND page=? AND copy=?
        ''', (student, page, copy))
        
        row = cur.fetchone()
        conn.close()
        
        if not row or not row['layout_image']:
            raise HTTPException(status_code=404, detail="Layout image not found in DB")
            
        image_name = row['layout_image']
        image_path = project_dir / "cr" / image_name
        
        if not image_path.exists():
            raise HTTPException(status_code=404, detail="Layout image file not found")
            
        return FileResponse(image_path)
    except HTTPException:
        raise
    except Exception as e:
        print("Error reading layout image:", e)
        raise HTTPException(status_code=500, detail="Database error")

@router.delete("/{name}/capture")
def delete_capture(name: str, student: int, page: int, copy: int = 0):
    project_dir = PROJECTS_ROOT / name
    db_path = project_dir / "data" / "capture.sqlite"
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Capture data not found")

    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        
        # Get the image name to delete it from cr/
        cur.execute("SELECT layout_image FROM capture_page WHERE student=? AND page=? AND copy=?", (student, page, copy))
        row = cur.fetchone()
        if row and row[0]:
            img_path = project_dir / "cr" / row[0]
            if img_path.exists():
                try:
                    img_path.unlink()
                except Exception:
                    pass

        cur.execute("DELETE FROM capture_page WHERE student=? AND page=? AND copy=?", (student, page, copy))
        cur.execute("DELETE FROM capture_zone WHERE student=? AND page=? AND copy=?", (student, page, copy))
        conn.commit()
        conn.close()
        
        return {"message": "Capture deleted"}
    except Exception as e:
        print("Error deleting capture:", e)
        raise HTTPException(status_code=500, detail="Database error")

@router.get("/{name}/manual_pages")
def get_manual_pages(name: str):
    project_dir = PROJECTS_ROOT / name
    db_path = project_dir / "data" / "layout.sqlite"
    if not db_path.exists():
        return {"pages": []}
        
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT student, page, subjectpage, width, height, dpi FROM layout_page ORDER BY student, page")
        rows = cur.fetchall()
        pages = [dict(r) for r in rows]
        conn.close()
        return {"pages": pages}
    except Exception as e:
        print("Error reading manual_pages:", e)
        raise HTTPException(status_code=500, detail="Database error")

@router.get("/{name}/subject_page")
def get_subject_page(name: str, page: int):
    project_dir = PROJECTS_ROOT / name
    pdf_path = project_dir / "DOC-sujet.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="DOC-sujet.pdf not found")
        
    cr_dir = project_dir / "cr" / "subject"
    cr_dir.mkdir(parents=True, exist_ok=True)
    
    png_path = cr_dir / f"page-{page}.png"
    if not png_path.exists():
        try:
            import subprocess
            # pdftoppm -f Z -l Z -png -singlefile input output
            prefix = str(cr_dir / f"page-{page}")
            subprocess.run(['pdftoppm', '-f', str(page), '-l', str(page), '-png', '-singlefile', '-r', '300', str(pdf_path), prefix], check=True)
        except Exception as e:
            print("Error generating subject page:", e)
            raise HTTPException(status_code=500, detail="Error extracting PDF page")
            
    if not png_path.exists():
        raise HTTPException(status_code=404, detail="Page extraction failed")
        
    return FileResponse(png_path)

@router.get("/{name}/manual_layout")
def get_manual_layout(name: str, student: int, page: int):
    project_dir = PROJECTS_ROOT / name
    db_path = project_dir / "data" / "layout.sqlite"
    if not db_path.exists():
        return {"boxes": []}
        
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        # Fetch answer boxes
        cur.execute("SELECT question, answer, xmin, xmax, ymin, ymax, role FROM layout_box WHERE student=? AND page=? AND role=1", (student, page))
        rows = cur.fetchall()
        boxes = [dict(r) for r in rows]
        conn.close()
        return {"boxes": boxes}
    except Exception as e:
        print("Error reading manual_layout:", e)
        raise HTTPException(status_code=500, detail="Database error")

@router.get("/{name}/capture_zone_state")
def get_capture_zone_state(name: str, student: int, page: int, copy: int = 0):
    project_dir = PROJECTS_ROOT / name
    db_path = project_dir / "data" / "capture.sqlite"
    if not db_path.exists():
        return {"states": []}
        
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT id_a, id_b, manual, black, total, type FROM capture_zone WHERE student=? AND page=? AND copy=? AND type=4", (student, page, copy))
        rows = cur.fetchall()
        states = [dict(r) for r in rows]
        conn.close()
        return {"states": states}
    except Exception as e:
        print("Error reading capture zone states:", e)
        raise HTTPException(status_code=500, detail="Database error")

class ToggleRequest(BaseModel):
    student: int
    page: int
    copy: int = 0
    question: int
    answer: int
    checked: bool

@router.post("/{name}/capture_zone_toggle")
def toggle_capture_zone(name: str, req: ToggleRequest):
    project_dir = PROJECTS_ROOT / name
    db_path = project_dir / "data" / "capture.sqlite"
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Capture data not found")
        
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        now = int(time.time())
        
        # Ensure capture_page exists
        cur.execute("SELECT 1 FROM capture_page WHERE student=? AND page=? AND copy=?", (req.student, req.page, req.copy))
        if not cur.fetchone():
            cur.execute("INSERT INTO capture_page (student, page, copy, timestamp_manual) VALUES (?, ?, ?, ?)", (req.student, req.page, req.copy, now))
        else:
            cur.execute("UPDATE capture_page SET timestamp_manual=? WHERE student=? AND page=? AND copy=?", (now, req.student, req.page, req.copy))
            
        # Toggle capture_zone
        manual_val = 1.0 if req.checked else 0.0
        cur.execute("SELECT 1 FROM capture_zone WHERE student=? AND page=? AND copy=? AND type=4 AND id_a=? AND id_b=?", (req.student, req.page, req.copy, req.question, req.answer))
        if not cur.fetchone():
            cur.execute("INSERT INTO capture_zone (student, page, copy, type, id_a, id_b, manual, black, total) VALUES (?, ?, ?, 4, ?, ?, ?, -1, -1)", 
                (req.student, req.page, req.copy, req.question, req.answer, manual_val))
        else:
            cur.execute("UPDATE capture_zone SET manual=? WHERE student=? AND page=? AND copy=? AND type=4 AND id_a=? AND id_b=?", 
                (manual_val, req.student, req.page, req.copy, req.question, req.answer))
                
        conn.commit()
        conn.close()
        return {"message": "Success"}
    except Exception as e:
        print("Error toggling capture zone:", e)
        raise HTTPException(status_code=500, detail="Database error")

@router.post("/from_archive")
def create_project_from_archive(name: str = Form(...), file: UploadFile = File(...)):
    try:
        project_dir = PROJECTS_ROOT / name
        if project_dir.exists():
            raise HTTPException(status_code=400, detail="Project already exists")
        amc_proj = AMCProject(base_path=str(PROJECTS_ROOT), project_name=name)
        amc_proj.create()

        archive_path = project_dir / file.filename
        with open(archive_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        if file.filename.endswith(".zip"):
            with zipfile.ZipFile(archive_path, "r") as zf:
                zf.extractall(project_dir)
        elif file.filename.endswith(".tgz") or file.filename.endswith(".tar.gz"):
            with tarfile.open(archive_path, "r:gz") as tf:
                tf.extractall(project_dir)
        else:
            shutil.rmtree(project_dir)
            raise HTTPException(status_code=400, detail="Unsupported archive format")
        
        archive_path.unlink()

        tex_files = list(project_dir.glob("*.tex"))
        txt_files = list(project_dir.glob("*.txt"))
        
        found_source = None
        if tex_files:
            found_source = tex_files[0]
            target_source = project_dir / f"{name}.tex"
        elif txt_files:
            found_source = txt_files[0]
            target_source = project_dir / f"{name}.txt"
        else:
            raise HTTPException(status_code=400, detail="No .tex or .txt file found in archive")
        
        if found_source and (found_source != target_source):
            if target_source.exists():
                target_source.unlink()
            found_source.rename(target_source)

        return {"message" : f"Project '{name}' created successfully from archive", "name" : name}
    
    except HTTPException:
        raise
    except Exception as e:
        if 'project_dir' in locals() and project_dir.exists():
            shutil.rmtree(project_dir)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{name}/anonymize")
def anonymize_project(name: str):
    try:
        amc_proj = AMCProject(base_path=str(PROJECTS_ROOT), project_name=name)
        settings = load_settings()
        amc_proj.anonymize(settings)
        return {"success": True, "message": "Anonymized PDFs generated successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{name}/anonymous_documents")
def download_anonymous_documents(name: str):
    import zipfile
    import tempfile
    from starlette.background import BackgroundTask
    from fastapi.responses import FileResponse
    try:
        amc_proj = AMCProject(base_path=str(PROJECTS_ROOT), project_name=name)
        anon_dir = amc_proj.anonymous_dir
        if not anon_dir.exists() or not any(anon_dir.iterdir()):
            raise HTTPException(status_code=404, detail="No anonymized documents found.")
            
        # Create a temporary zip file
        temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
        with zipfile.ZipFile(temp_zip.name, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for pdf_file in anon_dir.glob("*.pdf"):
                zipf.write(pdf_file, pdf_file.name)
        
        return FileResponse(
            temp_zip.name,
            media_type="application/zip",
            filename=f"{name}_anonymous.zip",
            background=BackgroundTask(lambda: os.unlink(temp_zip.name))
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{name}/external_scores")
def import_external_scores(name: str, file: UploadFile = File(...)):
    amc_proj = get_amc_project(name)
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed.")
    target_path = get_project_file(amc_proj, file.filename, suffix='.csv')
    with open(target_path, 'wb') as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        amc_proj.import_external_scores(csv_file_path=str(target_path))
        return {"success": True, "message": "External scores imported successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    



@router.delete("/{name}/external_scores")
def clear_external_scores(name: str):
    try:
        amc_proj = AMCProject(base_path=str(PROJECTS_ROOT), project_name=name)
        amc_proj.clear_external_scores()
        return {"success": True, "message": "External scores cleared successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
