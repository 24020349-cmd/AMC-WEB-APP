import os
import shutil
import subprocess
import re
import xml.etree.ElementTree as ET
from pathlib import Path

class AMCProject:
    def __init__(self, base_path: str, project_name: str):
        """
        Khởi tạo hoặc tải một dự án AMC với các đường dẫn thư mục cần thiết.
        """
        self.project_dir = Path(base_path) / project_name
        self.data_dir = self.project_dir / "data"
        self.cr_dir = self.project_dir / "cr"
        self.scans_dir = self.project_dir / "scans"
        self.exports_dir = self.project_dir / "exports"
        self.build_dir = self.project_dir / "_build"
        self.anonymous_dir = self.project_dir / "anonymous"

    def create(self):
        """
        Tạo cấu trúc thư mục chuẩn cho một dự án AMC mới và khởi tạo các tệp cấu hình mặc định.
        """
        if self.project_dir.exists():
            raise FileExistsError(f"Project '{self.project_dir.name}' already exists.")

        # Tạo các thư mục con
        directories = [
            self.project_dir,
            self.data_dir,
            self.cr_dir,
            self.scans_dir,
            self.exports_dir,
            self.build_dir,
            self.anonymous_dir
        ]
        
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
            
        # Tạo các file cấu hình mặc định (description.xml, options.xml)
        self._create_default_xml_files()

        # Tạo file list.csv mặc định cho nhận diện sinh viên
        list_csv_path = self.project_dir / "list.csv"
        with open(list_csv_path, 'w', encoding='utf-8') as f:
            f.write("name,forename,id\n")
            f.write("Tuan1,DinhVu,24020349\n")
            f.write("Tuan2,ThiVu,24020341\n")
        
        print(f"Project '{self.project_dir.name}' created successfully at {self.project_dir}")

    def delete(self):
        """
        Xóa vĩnh viễn toàn bộ thư mục dự án.
        """
        if self.project_dir.exists():
            shutil.rmtree(self.project_dir)
            print(f"Project '{self.project_dir.name}' deleted.")

    def rename(self, new_name: str):
        """
        Đổi tên thư mục dự án và cập nhật lại tên các tệp nguồn bên trong.
        """
        new_project_dir = self.project_dir.parent / new_name
        if new_project_dir.exists():
            raise FileExistsError(f"Project '{new_name}' already exists.")
        
        # Đổi tên thư mục
        shutil.move(str(self.project_dir), str(new_project_dir))
        print(f"Renamed project directory to {new_project_dir}")
        
        # Đổi tên file gốc (nếu trùng tên với dự án cũ)
        old_name = self.project_dir.name
        for ext in ['.tex', '.txt']:
            old_file = new_project_dir / f"{old_name}{ext}"
            new_file = new_project_dir / f"{new_name}{ext}"
            if old_file.exists():
                shutil.move(str(old_file), str(new_file))
                print(f"Renamed file {old_file.name} to {new_file.name}")
        
        # Cập nhật lại đường dẫn nội bộ
        self.project_dir = new_project_dir
        self.data_dir = self.project_dir / "data"
        self.cr_dir = self.project_dir / "cr"
        self.scans_dir = self.project_dir / "scans"
        self.exports_dir = self.project_dir / "exports"
        self.build_dir = self.project_dir / "_build"
        self.anonymous_dir = self.project_dir / "anonymous"

    def copy(self, new_name: str):
        """
        Nhân bản thư mục dự án sang một tên mới và cập nhật lại các tệp nguồn.
        """
        new_project_dir = self.project_dir.parent / new_name
        if new_project_dir.exists():
            raise FileExistsError(f"Project '{new_name}' already exists.")
        
        # Copy toàn bộ thư mục
        shutil.copytree(str(self.project_dir), str(new_project_dir))
        print(f"Cloned project directory to {new_project_dir}")
        
        # Đổi tên file gốc trong thư mục mới (nếu trùng tên với dự án cũ)
        old_name = self.project_dir.name
        for ext in ['.tex', '.txt']:
            old_file = new_project_dir / f"{old_name}{ext}"
            new_file = new_project_dir / f"{new_name}{ext}"
            if old_file.exists():
                shutil.move(str(old_file), str(new_file))
                print(f"Renamed cloned file {old_file.name} to {new_file.name}")

    def export_zip_template(self, dest_dir: str, file_name: str, short_name: str, description: str, included_files: list) -> str:
        """
        Đóng gói dự án thành tệp ZIP mẫu để lưu trữ hoặc chia sẻ.
        """
        model_dir = Path(dest_dir)
        model_dir.mkdir(parents=True, exist_ok=True)
        
        if not file_name.endswith('.zip') and not file_name.endswith('.tgz'):
            file_name += '.zip'
            
        output_zip_path = model_dir / file_name

        import xml.etree.ElementTree as ET
        root = ET.Element("projetAMC")
        title_elem = ET.SubElement(root, "title")
        title_elem.text = short_name
        text_elem = ET.SubElement(root, "text")
        text_elem.text = description

        xml_data = ET.tostring(root, encoding='utf-8', method='xml', xml_declaration=True)

        from zipfile import ZipFile
        with ZipFile(output_zip_path, 'w') as zipf:
            zipf.writestr('description.xml', xml_data)
            
            for file in included_files:
                if file != 'description.xml':
                    file_path = self.project_dir / file
                    if file_path.exists():
                        zipf.write(file_path, arcname=file)
                        
        return str(output_zip_path)
    
    def get_cleanup_info(self) -> dict:
        """
        Lấy thông tin dung lượng của các thư mục trung gian cần dọn dẹp.
        """
        def get_dir_size(path: Path) -> int:
            """
            Tính tổng dung lượng (byte) của tất cả các tệp trong thư mục.
            """
            if not path.exists() or not path.is_dir():
                return 0
            return sum(f.stat().st_size for f in path.rglob('*') if f.is_file())

        def format_size(size: int) -> str:
            """
            Chuyển đổi kích thước byte sang định dạng chuỗi dễ đọc (B, KB, MB, GB).
            """
            if size == 0: return "0"
            if size < 1024: return f"{size} B"
            elif size < 1024 * 1024: return f"{size / 1024:.1f}k"
            elif size < 1024 * 1024 * 1024: return f"{size / (1024 * 1024):.2f}M"
            else: return f"{size / (1024 * 1024 * 1024):.2f}G"

        zooms_dir = self.cr_dir / "zooms"
        zooms_size = get_dir_size(zooms_dir)

        layout_dir = self.cr_dir / "diagnostic"
        layout_size = get_dir_size(layout_dir)

        annotated_dir = self.cr_dir / "corrections" / "jpg"
        annotated_size = get_dir_size(annotated_dir)

        return {
            "zooms": {"size_bytes": zooms_size, "size_str": format_size(zooms_size)},
            "layout_reports": {"size_bytes": layout_size, "size_str": format_size(layout_size)},
            "annotated_pages": {"size_bytes": annotated_size, "size_str": format_size(annotated_size)}
        }

    def cleanup(self, zooms: bool, layout_reports: bool, annotated_pages: bool):
        """
        Xóa nội dung của các thư mục trung gian đã chọn để giải phóng dung lượng.
        """
        def clear_dir(path: Path):
            """
            Xóa sạch và tạo lại thư mục trống nếu thư mục tồn tại.
            """
            if path.exists() and path.is_dir():
                shutil.rmtree(path, ignore_errors=True)
                path.mkdir(parents=True, exist_ok=True)
                
        if zooms:
            clear_dir(self.cr_dir / "zooms")
        if layout_reports:
            clear_dir(self.cr_dir / "diagnostic")
        if annotated_pages:
            clear_dir(self.cr_dir / "corrections" / "jpg")

    def _create_default_xml_files(self):
        """
        Tạo các tệp cấu hình XML mặc định (description.xml và options.xml) cho dự án.
        """
        desc_path = self.project_dir / "description.xml"
        options_path = self.project_dir / "options.xml"
        
        with open(desc_path, 'w', encoding='utf-8') as f:
            f.write('<?xml version="1.0" encoding="UTF-8"?>\n<project>\n</project>')
            
        with open(options_path, 'w', encoding='utf-8') as f:
            f.write('<?xml version="1.0" encoding="UTF-8"?>\n<projetAMC>\n  <project_version>1</project_version>\n</projetAMC>')

    def ensure_valid_options_file(self):
        """
        Đảm bảo tệp options.xml tồn tại và có cấu trúc XML hợp lệ.
        """
        options_path = self.project_dir / "options.xml"
        if not options_path.exists():
            self._create_default_xml_files()
            return
        content = options_path.read_text(encoding='utf-8')
        if re.search(r'<projetAMC>\s*</projetAMC>', content):
            options_path.write_text(
                '<?xml version="1.0" encoding="UTF-8"?>\n<projetAMC>\n  <project_version>1</project_version>\n</projetAMC>',
                encoding='utf-8',
            )

    def get_option(self, key: str, default: str = "") -> str:
        """
        Đọc giá trị của một tùy chọn từ tệp options.xml.
        """
        options_path = self.project_dir / "options.xml"
        if not options_path.exists():
            return default
        try:
            tree = ET.parse(options_path)
            root = tree.getroot()
            elem = root.find(key)
            if elem is not None and elem.text is not None:
                return elem.text
        except Exception:
            pass
        return default

    def set_option(self, key: str, value: str):
        """
        Lưu hoặc cập nhật một tùy chọn vào tệp options.xml.
        """
        options_path = self.project_dir / "options.xml"
        self.ensure_valid_options_file()
        try:
            tree = ET.parse(options_path)
            root = tree.getroot()
            elem = root.find(key)
            if elem is None:
                elem = ET.SubElement(root, key)
            elem.text = str(value)
            tree.write(options_path, encoding='utf-8', xml_declaration=True)
        except Exception as e:
            print(f"Error setting option {key}: {e}")

    def get_project_preferences(self, global_defaults: dict | None = None) -> dict:
        """
        Lấy các cài đặt của project này từ options.xml.
        Nếu một trường chưa có trong options.xml thì tự động lấy giá trị mặc định từ global_defaults (app_settings.json).
        """
        if global_defaults is None:
            import json
            settings_path = Path(__file__).resolve().parent / "app_settings.json"
            if settings_path.exists():
                try:
                    global_defaults = json.loads(settings_path.read_text(encoding='utf-8'))
                except Exception:
                    global_defaults = {}
            else:
                global_defaults = {}

        def _fmt_num(val, default):
            """
            Định dạng số thành chuỗi hiển thị gọn (bỏ phần thập phân nếu là số nguyên).
            """
            if val is None or val == "":
                return default
            try:
                f = float(val)
                return str(int(f)) if f.is_integer() else str(f)
            except (ValueError, TypeError):
                return str(val)


        default_seuil = float(global_defaults.get("default_darkness_threshold", 0.15))
        default_seuil_up = float(global_defaults.get("default_upper_darkness_threshold", 1.00))
        default_name_field = str(global_defaults.get("name_field_type", "image"))
        default_note_null = _fmt_num(global_defaults.get("minimal_mark", 0), "0")
        default_note_min = _fmt_num(global_defaults.get("note_min", ""), "")
        default_note_max = _fmt_num(global_defaults.get("maximal_mark", 20), "20")
        default_note_grain = _fmt_num(global_defaults.get("mark_grain", 0.5), "0.5")
        default_note_arrondi = str(global_defaults.get("rounding_type", "rounding"))
        default_verdict = str(global_defaults.get("header_annotations", "%(aID)"))

        options_path = self.project_dir / "options.xml"
        opts = {}
        if options_path.exists():
            try:
                tree = ET.parse(options_path)
                root = tree.getroot()
                for child in root:
                    if child.text is not None:
                        opts[child.tag] = child.text
            except Exception as e:
                print(f"Error parsing {options_path}: {e}")

        def _get_float(key, fallback):
            """
            Trích xuất giá trị số thực float từ dictionary tùy chọn, trả về giá trị dự phòng nếu lỗi.
            """
            val = opts.get(key)
            if val is not None and str(val).strip() != "":
                try:
                    return float(val)
                except ValueError:
                    pass
            return fallback

        def _get_bool(key, fallback):
            """
            Trích xuất giá trị logic boolean (True/False) từ dictionary tùy chọn.
            """
            val = opts.get(key)
            if val is not None and str(val).strip() != "":
                return str(val).strip() in ("1", "true", "True", "yes")
            return fallback

        def _get_str(key, fallback):
            """
            Trích xuất giá trị chuỗi string từ dictionary tùy chọn.
            """
            val = opts.get(key)
            if val is not None:
                return val
            return fallback

        return {
            "seuil": _get_float("seuil", default_seuil),
            "seuil_up": _get_float("seuil_up", default_seuil_up),
            "name_field_type": _get_str("name_field_type", default_name_field),
            "note_null": _get_str("note_null", default_note_null),
            "note_min": _get_str("note_min", default_note_min),
            "note_max": _get_str("note_max", default_note_max),
            "note_max_plafond": _get_bool("note_max_plafond", True),
            "note_grain": _get_str("note_grain", default_note_grain),
            "note_arrondi": _get_str("note_arrondi", default_note_arrondi),
            "verdict": _get_str("verdict", default_verdict),
            "annote_rtl": _get_bool("annote_rtl", False),
            "annote_position": _get_str("annote_position", "marges"),
            "verdict_q": _get_str("verdict_q", '"%s/%m"'),
            "verdict_qc": _get_str("verdict_qc", '"X"'),
            "nom_examen": _get_str("nom_examen", ""),
            "code_examen": _get_str("code_examen", self.project_dir.name),
            "modele_regroupement": _get_str("modele_regroupement", "(N)-(ID)"),
            "_overridden": [k for k in opts.keys() if k != "project_version"],
        }

    def set_project_preferences(self, prefs: dict):
        """
        Lưu các cài đặt cụ thể của project này vào options.xml.
        """
        self.ensure_valid_options_file()
        options_path = self.project_dir / "options.xml"
        try:
            tree = ET.parse(options_path)
            root = tree.getroot()
            for key, val in prefs.items():
                if val is None or key.startswith("_"):
                    continue
                elem = root.find(key)
                if elem is None:
                    elem = ET.SubElement(root, key)
                if isinstance(val, bool):
                    elem.text = "1" if val else "0"
                else:
                    elem.text = str(val)
            tree.write(options_path, encoding='utf-8', xml_declaration=True)
        except Exception as e:
            print(f"Error saving project preferences to {options_path}: {e}")

    def ensure_vietnamese_latex_support(self, tex_file_path: str):
        """
        Tự động thêm gói hỗ trợ tiếng Việt VnTeX cho tệp nguồn LaTeX nếu phát hiện ký tự có dấu.
        """
        source = Path(tex_file_path)
        try:
            content = source.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            return


        if not re.search(r"[\u0102-\u0103\u0110-\u0111\u01A0-\u01B0\u1EA0-\u1EF9]", content):
            return
        if re.search(r"\\usepackage(?:\[[^\]]*\])?\{vntex\}", content):
            return


        content = re.sub(r"^\s*\\usepackage(?:\[[^\]]*\])?\{inputenc\}\s*\n?", "", content, flags=re.MULTILINE)
        content = re.sub(r"^\s*\\usepackage(?:\[[^\]]*\])?\{fontenc\}\s*\n?", "", content, flags=re.MULTILINE)
        vntex_line = "% AMC-WEB: Vietnamese UTF-8 support\n\\usepackage[utf8]{vntex}\n"
        documentclass = re.search(r"\\documentclass(?:\[[^\]]*\])?\{[^}]+\}", content)
        if not documentclass:
            return
        insert_at = documentclass.end()
        content = content[:insert_at] + "\n" + vntex_line + content[insert_at:]
        source.write_text(content, encoding="utf-8", newline="\n")

    def _run_amc(self, args: list, strict=True):
        """
        Thực thi lệnh gọi công cụ Auto Multiple Choice (AMC) qua subprocess.
        """
        self.ensure_valid_options_file()
        print('Running: {}'.format(' '.join(args)))
        result = subprocess.run(args, capture_output=True, text=True, cwd=str(self.project_dir))
        if result.returncode != 0:
            print('Error: {}'.format(result.returncode))
            print('Stderr: {}'.format(result.stderr))
            if strict:
                error_msg = result.stderr.strip() if result.stderr.strip() else result.stdout.strip()
                raise RuntimeError('Command Failed: {}'.format(error_msg))
        return result

    # -------------------------------------------------------------------------
    # PIPELINE STEPS (Tương đương với Lifecycle AMC CLI)
    # -------------------------------------------------------------------------

    def prepare(self, tex_file_path: str):
        """
        Bước 1: prepare (mode s + mode b)
        Đọc file .tex, biên dịch LaTeX -> PDF, ghi tọa độ câu hỏi/ô đáp án vào layout.sqlite.
        """
        if not tex_file_path.endswith('.txt'):
            self.ensure_vietnamese_latex_support(tex_file_path)
        print(f"[{self.project_dir.name}] STEP 1: Running prepare on {tex_file_path}")
        is_txt = Path(tex_file_path).suffix == '.txt'
        cmd_s = [
            "auto-multiple-choice", "prepare",
            "--mode", "sk",
            "--prefix", str(self.project_dir) + "/",
            "--data", str(self.data_dir),
            "--out-sujet", str(self.project_dir / "DOC-sujet.pdf"),
            "--out-corrige", str(self.project_dir / "DOC-corrige.pdf"),
            "--out-calage", str(self.project_dir / "DOC-calage.xy"),
            "--out-corrige-indiv", str(self.project_dir / "DOC-indiv-solution.pdf"),
            "--with", "pdflatex",
            "--filter", "plain" if is_txt else "latex",
            tex_file_path
        ]
        self._run_amc(cmd_s, strict=False)

        subject_pdf = self.project_dir / 'DOC-sujet.pdf'
        compiled_pdf = self.project_dir / 'amc-compiled.pdf'
        if not subject_pdf.exists() and compiled_pdf.exists():
            os.rename(compiled_pdf, subject_pdf)
            
        calage_xy = self.project_dir / 'DOC-calage.xy'
        compiled_xy = self.project_dir / 'amc-compiled.xy'
        if not calage_xy.exists() and compiled_xy.exists():
            os.rename(compiled_xy, calage_xy)

        cmd_b = [
            "auto-multiple-choice", "prepare",
            "--mode", "b",
            "--data", str(self.data_dir),
            "--source", tex_file_path,
            "--with", "pdflatex",
            "--filter", "plain" if is_txt else "latex"
        ]
        self._run_amc(cmd_b, strict=False)

    def prepare_scoring(self, tex_file_path: str):
        """
        Cập nhật lại thang điểm và đáp án từ tệp nguồn vào cơ sở dữ liệu scoring mà không tạo lại PDF.
        """
        print(f"[{self.project_dir.name}] STEP: Updating marking scale from {tex_file_path}")
        is_txt = Path(tex_file_path).suffix == '.txt'
        cmd_s = [
            "auto-multiple-choice", "prepare",
            "--mode", "s",
            "--prefix", str(self.project_dir) + "/",
            "--data", str(self.data_dir),
            "--with", "pdflatex",
            "--filter", "plain" if is_txt else "latex",
            tex_file_path
        ]
        self._run_amc(cmd_s, strict=False)

    def compile_with_log(self, tex_file_path: str) -> dict:
        """
        Biên dịch tệp LaTeX hoặc AMC-TXT và ghi lại các lỗi biên dịch.
        """

        if not tex_file_path.endswith('.txt'):
            self.ensure_vietnamese_latex_support(tex_file_path)
        
        from pathlib import Path
        import subprocess
        tex_file_path_obj = Path(tex_file_path)
        tex_file_name = tex_file_path_obj.name
        is_txt = tex_file_path_obj.suffix == '.txt'
        
        log_output = ""
        success = True
        returncode = 0
        

        if not is_txt:
            pdflatex_cmd = [
                "pdflatex", 
                "-interaction=nonstopmode",
                tex_file_name
            ]
            
            print(f"[{self.project_dir.name}] Running pdflatex directly for logs")
            result = subprocess.run(pdflatex_cmd, capture_output=True, text=True, cwd=str(self.project_dir))
            
            log_output = result.stdout
            if result.stderr:
                log_output += "\n" + result.stderr
                
            success = (result.returncode == 0)
            returncode = result.returncode


        if success or is_txt:
            amc_cmd = [
                "auto-multiple-choice", "prepare",
                "--mode", "s",
                "--prefix", str(self.project_dir) + "/",
                "--data", str(self.data_dir),
                "--out-sujet", str(self.project_dir / "DOC-sujet.pdf"),
                "--out-corrige", str(self.project_dir / "DOC-corrige.pdf"),
                "--out-calage", str(self.project_dir / "DOC-calage.xy"),
                "--with", "pdflatex",
                "--filter", "plain" if is_txt else "latex",
                tex_file_path
            ]
            print(f"[{self.project_dir.name}] Running AMC prepare: {' '.join(amc_cmd)}")
            amc_result = subprocess.run(amc_cmd, capture_output=True, text=True, cwd=str(self.project_dir))
            
            if is_txt:
                log_output += amc_result.stdout
                if amc_result.stderr:
                    log_output += "\n" + amc_result.stderr
                success = (amc_result.returncode == 0)
                returncode = amc_result.returncode
            else:
                log_output += "\n\n--- AMC PREPARE ---\n" + amc_result.stdout
                if amc_result.stderr:
                    log_output += "\n" + amc_result.stderr
                if amc_result.returncode != 0:
                    success = False
                    returncode = amc_result.returncode

        return {
            "success": success,
            "log": log_output,
            "returncode": returncode
        }

    def meptex(self):
        """
        Bước 2: meptex
        Đọc file .xy (tọa độ marker), bổ sung thêm dữ liệu vào layout.sqlite.
        """
        xy_file_path = str(self.project_dir / "DOC-calage.xy")
        print(f"[{self.project_dir.name}] STEP 2: Running meptex on {xy_file_path}")
        cmd = [
            "auto-multiple-choice", "meptex",
            "--data", str(self.data_dir),
            "--src", xy_file_path
        ]
        self._run_amc(cmd, strict=False)

    def analyse(self, scan_options: dict | None = None):
        """
        Bước 3: analyse
        Đọc ảnh scan trong thư mục scans/, dò marker gốc + đo mức tô từng ô, ghi vào capture.sqlite.
        """
        print(f"[{self.project_dir.name}] STEP 3: Running analyse on scans")
        # Quét tất cả các file ảnh trong thư mục scans/
        scan_files = [str(p) for p in self.scans_dir.glob("*.*") if p.is_file()]
        if not scan_files:
            print("No scans found to analyse.")
            return

        options = scan_options or {}
        proj_prefs = self.get_project_preferences()
        tolerance_decrease = float(options.get('marks_size_max_decrease', 0.20))
        tolerance_increase = float(options.get('marks_size_max_increase', 0.20))
        bw_threshold = float(proj_prefs.get('seuil', options.get('scan_bw_threshold', 0.60)))
        cmd = [
            "auto-multiple-choice", "analyse",
            "--projet", str(self.project_dir),
            "--data", str(self.data_dir),
            "--cr", str(self.cr_dir),
            "--tol-marque", f"{tolerance_decrease},{tolerance_increase}",
            "--prop", str(float(options.get('measured_box_proportion', 0.80))),
            "--bw-threshold", str(bw_threshold),
        ] + scan_files
        if not bool(options.get('scan_ignore_red', True)):
            cmd.insert(-len(scan_files), "--no-ignore-red")
        self._run_amc(cmd, strict=True)

    def analyse_diagnostic(self, scan_file: str, scan_options: dict | None = None) -> Path:
        """
        Phân tích tệp ảnh quét ở chế độ chẩn đoán để tạo ảnh trực quan hỗ trợ xử lý lỗi nhận dạng.
        """
        clean_name = Path(scan_file).name
        target_scan_file = self.scans_dir / clean_name
        if not target_scan_file.exists():
            if "%PROJET" in scan_file:
                rel = scan_file.replace("%PROJET/", "").replace("%PROJET\\", "")
                target_scan_file = self.project_dir / rel
            if not target_scan_file.exists():
                raise FileNotFoundError(f"Scan file {scan_file} not found")

        diag_dir = self.cr_dir / "diagnostic"
        diag_dir.mkdir(parents=True, exist_ok=True)

        options = scan_options or {}
        proj_prefs = self.get_project_preferences()
        tolerance_decrease = float(options.get('marks_size_max_decrease', 0.20))
        tolerance_increase = float(options.get('marks_size_max_increase', 0.20))
        bw_threshold = float(proj_prefs.get('seuil', options.get('scan_bw_threshold', 0.60)))
        cmd = [
            "auto-multiple-choice", "analyse",
            "--projet", str(self.project_dir),
            "--data", str(self.data_dir),
            "--cr", str(self.cr_dir),
            "--debug-image-dir", str(diag_dir),
            "--no-tag-overwritten",
            "--tol-marque", f"{tolerance_decrease},{tolerance_increase}",
            "--prop", str(float(options.get('measured_box_proportion', 0.80))),
            "--bw-threshold", str(bw_threshold),
        ]
        if not bool(options.get('scan_ignore_red', True)):
            cmd.append("--no-ignore-red")
        if not bool(options.get('process_scans_with_three_corner_marks', True)):
            cmd.append("--no-try-three")
        cmd.append(str(target_scan_file))

        print(f"[{self.project_dir.name}] Running diagnostic analyse on {clean_name}")
        self._run_amc(cmd, strict=False)

        diag_files = list(diag_dir.glob(f"{clean_name}*"))
        if diag_files:
            return diag_files[0]
        for f in diag_dir.glob("*.png"):
            if clean_name in f.name:
                return f
        raise FileNotFoundError(f"Diagnostic image was not produced for {clean_name}")

    def _has_latex_scoring_definition(self) -> bool:
        """
        Kiểm tra xem trong cơ sở dữ liệu đã có chiến lược chấm điểm tùy chỉnh từ LaTeX hay chưa.
        """
        database = self.data_dir / "scoring.sqlite"
        if not database.exists():
            return False
        import sqlite3
        try:
            connection = sqlite3.connect(database)
            cursor = connection.cursor()
            for table in ("scoring_main", "scoring_default", "scoring_question", "scoring_answer"):
                exists = cursor.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()
                if not exists:
                    continue
                row = cursor.execute(f"SELECT 1 FROM {table} WHERE strategy IS NOT NULL AND TRIM(strategy) <> '' LIMIT 1").fetchone()
                if row:
                    connection.close()
                    return True
            connection.close()
        except Exception:
            return False
        return False


    def clear_external_scores(self):
        """
        Xóa tất cả điểm số bên ngoài khỏi cơ sở dữ liệu điểm số.
        """
        database = self.data_dir / "scoring.sqlite"
        if not database.exists():
            return False
            
        import sqlite3
        try:
            connection = sqlite3.connect(database)
            cursor = connection.cursor()
            cursor.execute("CREATE TABLE IF NOT EXISTS scoring_external (student INTEGER, copy INTEGER, question INTEGER, score REAL, PRIMARY KEY (student,copy,question))")
            cursor.execute("DELETE FROM scoring_external")
            connection.commit()
            connection.close()
            return True
        except sqlite3.Error as e:
            print(f"[{self.project_dir.name}] DB error clearing external scores: {e}")
            return False


    def get_anonymity_status(self):
        """
        Trả về số liệu thống kê về các bảng tính ẩn danh và điểm số từ bên ngoài.
        """
        status = {
            "sheets": 0,
            "scores": 0,
            "students": 0
        }
        

        if self.anonymous_dir.exists():
            status["sheets"] = len(list(self.anonymous_dir.glob("*.pdf")))
            
        database = self.data_dir / "scoring.sqlite"
        if database.exists():
            import sqlite3
            try:
                connection = sqlite3.connect(database)
                cursor = connection.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='scoring_external'")
                if cursor.fetchone():
                    cursor.execute("SELECT count(*), count(DISTINCT student) FROM scoring_external")
                    row = cursor.fetchone()
                    if row:
                        status["scores"] = row[0]
                        status["students"] = row[1]
                connection.close()
            except sqlite3.Error as e:
                print(f"[{self.project_dir.name}] DB error reading anonymity status: {e}")
                
        return status

    def is_postcorrect(self) -> bool:
        """
        Kiểm tra xem bài thi có được biên soạn với tùy chọn sửa lỗi sau khi làm bài (post-correct) hay không.
        """
        database = self.data_dir / "scoring.sqlite"
        if not database.exists():
            return False
        import sqlite3
        try:
            conn = sqlite3.connect(database)
            cursor = conn.cursor()
            row = cursor.execute("SELECT value FROM scoring_variables WHERE name='postcorrect_flag'").fetchone()
            conn.close()
            return bool(row and str(row[0]).strip() == '1')
        except Exception:
            return False

    def get_postcorrect_sheets(self) -> list[dict]:
        """
        Trả về danh sách các tờ đã quét (bài làm của học sinh, bản sao) có sẵn để thực hiện chấm lại.
        """
        database = self.data_dir / "capture.sqlite"
        if not database.exists():
            return []
        import sqlite3
        sheets = []
        try:
            conn = sqlite3.connect(database)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            rows = cursor.execute("SELECT DISTINCT student, copy FROM capture_page ORDER BY student, copy").fetchall()
            for r in rows:
                student = int(r["student"])
                copy = int(r["copy"])
                name_row = cursor.execute(
                    "SELECT image FROM capture_zone WHERE student=? AND copy=? AND type=2 LIMIT 1",
                    (student, copy)
                ).fetchone()
                name_image = name_row["image"] if name_row and name_row["image"] else None
                sheets.append({
                    "student": student,
                    "copy": copy,
                    "name_image": name_image
                })
            conn.close()
        except Exception as e:
            print(f"[{self.project_dir.name}] Error getting postcorrect sheets: {e}")
        return sheets

    def get_marks_table(self) -> dict:
        """
        Lấy bảng điểm tạm thời tương ứng với AMC::Gui::Notes.
        Trả về:
            columns: danh sách các tiêu đề câu hỏi
            rows: danh sách các phần tử dạng { exam, student, copy, mark, is_teacher, scores }
            mean: { exam: "mean", mark: mean_mark, scores: { [question]: "XX%" } }
        """
        database = self.data_dir / "scoring.sqlite"
        if not database.exists():
            return {"columns": [], "rows": [], "mean": None}

        import sqlite3
        import re

        try:
            conn = sqlite3.connect(database)
            conn.row_factory = sqlite3.Row


            vars_dict = dict(conn.execute("SELECT name, value FROM scoring_variables").fetchall())
            is_pc = vars_dict.get("postcorrect_flag") == "1"
            pc_student = -1
            pc_copy = -1
            if is_pc and "postcorrect_student" in vars_dict and vars_dict["postcorrect_student"]:
                try:
                    pc_student = int(vars_dict["postcorrect_student"])
                    pc_copy = int(vars_dict.get("postcorrect_copy", 0))
                except (ValueError, TypeError):
                    pass


            raw_questions = conn.execute("""
                SELECT q.question, t.title, q.indicative
                FROM scoring_question q
                JOIN scoring_title t ON q.question = t.question
                GROUP BY q.question
                ORDER BY t.title ASC
            """).fetchall()

            questions = [q for q in raw_questions if not re.search(r':\d+$', q["title"])]
            question_cols = [q["title"] for q in questions]

    
            marks = conn.execute("SELECT student, copy, total, max, mark FROM scoring_mark ORDER BY student, copy").fetchall()

            
            scores_rows = conn.execute("SELECT student, copy, question, score, max FROM scoring_score").fetchall()
            scores_map = {}
            for r in scores_rows:
                scores_map[(int(r["student"]), int(r["copy"]), int(r["question"]))] = r["score"]

            rows = []
            for m in marks:
                st = int(m["student"])
                cp = int(m["copy"])
                mark_val = m["mark"]
                exam_id = f"{st}:{cp}" if cp > 0 else str(st)
                is_teacher = is_pc and (st == pc_student and cp == pc_copy)
                q_scores = {}
                for q in questions:
                    s = scores_map.get((st, cp, int(q["question"])))
                    if s is not None:
                        q_scores[q["title"]] = f"{s:.2f}".rstrip("0").rstrip(".")
                    else:
                        q_scores[q["title"]] = ""
                
                rows.append({
                    "exam": exam_id,
                    "student": st,
                    "copy": cp,
                    "mark": f"{mark_val:.2f}".rstrip("0").rstrip(".") if mark_val is not None else "",
                    "is_teacher": is_teacher,
                    "scores": q_scores
                })

            
            if is_pc and pc_student >= 0:
                mean_mark_row = conn.execute(
                    "SELECT AVG(mark) FROM scoring_mark WHERE NOT (student=? AND copy=?)",
                    (pc_student, pc_copy)
                ).fetchone()
            else:
                mean_mark_row = conn.execute("SELECT AVG(mark) FROM scoring_mark").fetchone()
            mean_mark = mean_mark_row[0] if mean_mark_row else None

            mean_scores = {}
            for q in questions:
                if q["indicative"] == 1:
                    mean_scores[q["title"]] = "-"
                else:
                    qid = int(q["question"])
                    if is_pc and pc_student >= 0:
                        sql = """
                            SELECT CASE
                                WHEN SUM(max) > 0 THEN 100.0 * SUM(score) / SUM(max)
                                ELSE NULL
                            END
                            FROM scoring_score
                            WHERE question=? AND NOT (student=? AND copy=?)
                        """
                        res = conn.execute(sql, (qid, pc_student, pc_copy)).fetchone()[0]
                    else:
                        sql = """
                            SELECT CASE
                                WHEN SUM(max) > 0 THEN 100.0 * SUM(score) / SUM(max)
                                ELSE NULL
                            END
                            FROM scoring_score
                            WHERE question=?
                        """
                        res = conn.execute(sql, (qid,)).fetchone()[0]
                    mean_scores[q["title"]] = f"{round(res)}%" if res is not None else "?"

            mean_row = {
                "exam": "mean",
                "mark": f"{mean_mark:.2f}".rstrip("0").rstrip(".") if mean_mark is not None else "",
                "scores": mean_scores
            }

            conn.close()
            return {
                "columns": question_cols,
                "rows": rows,
                "mean": mean_row
            }
        except Exception as e:
            print(f"[{self.project_dir.name}] Error getting marks table: {e}")
            return {"columns": [], "rows": [], "mean": None}

    def note(self, scoring_options: dict | None = None, postcorrect: tuple[int, int, bool] | None = None):
        """
        Bước 4: note
        Đọc capture.sqlite (ô nào tick) + scoring.sqlite (đáp án đúng), chạy scoring, ghi ngược lại vào scoring.sqlite.
        """
        print(f"[{self.project_dir.name}] STEP 4: Running note (scoring)")
        proj_prefs = self.get_project_preferences()
        seuil = str(proj_prefs.get('seuil', 0.15))
        seuil_up = str(proj_prefs.get('seuil_up', 1.00))
        notenull = str(proj_prefs.get('note_null', '0'))
        notemax = str(proj_prefs.get('note_max', '20'))
        notemin = str(proj_prefs.get('note_min', ''))
        grain = str(proj_prefs.get('note_grain', '0.5'))
        plafond = proj_prefs.get('note_max_plafond', True)

        rounding_modes = {"rounding": "n", "arrondi": "n", "ceiling": "s", "sup": "s", "floor": "i", "inf": "i"}
        rounding = rounding_modes.get(str(proj_prefs.get("note_arrondi", "rounding")).lower(), "n")

        cmd = [
            "auto-multiple-choice", "note",
            "--project", str(self.project_dir),
            "--data", str(self.data_dir),
            "--seuil", seuil,
            "--seuil-up", seuil_up,
            "--grain", grain,
            "--notemax", notemax,
            "--arrondi", rounding,
            "--notenull", notenull,
        ]
        if plafond:
            cmd.append("--plafond")
        else:
            cmd.append("--no-plafond")
        if notemin != '':
            cmd.extend(["--notemin", notemin])

        if postcorrect:
            student, copy, set_multiple = postcorrect
            cmd.extend([
                "--postcorrect-student", str(student),
                "--postcorrect-copy", str(copy),
            ])
            if set_multiple:
                cmd.append("--postcorrect-set-multiple")
            else:
                cmd.append("--no-postcorrect-set-multiple")

        self._run_amc(cmd, strict=False)

       
        try:
            import sqlite3
            scoring_db = self.data_dir / 'scoring.sqlite'
            if scoring_db.exists():
                sconn = sqlite3.connect(scoring_db)
                sconn.execute("INSERT OR REPLACE INTO scoring_variables (name, value) VALUES ('mark_max', ?)", (notemax,))
                sconn.commit()
                sconn.close()
        except Exception as e:
            print(f"Error syncing mark_max in scoring_variables: {e}")

    def association_auto(self, csv_file_path: str):
        """
        Bước 5: association-auto
        Đọc mã số sinh viên từ capture.sqlite, khớp với danh sách sinh viên (CSV), ghi vào association.sqlite.
        """
        print(f"[{self.project_dir.name}] STEP 5: Running association-auto with {csv_file_path}")
        cmd = [
            "auto-multiple-choice", "association-auto",
            "--data", str(self.data_dir),
            "--liste", csv_file_path,
            "--liste-key", "id",       
            "--notes-id", "student"    
        ]
        self._run_amc(cmd, strict=False)

    def association_auto_with_options(self, csv_file_path: str, primary_key: str, code_name: str):
        """
        Liên kết các giá trị mã AMC đã giải mã với một cột khóa CSV được chọn.
        """
        print(f"[{self.project_dir.name}] Automatic association using {code_name} -> {primary_key}")
        cmd = [
            "auto-multiple-choice", "association-auto",
            "--data", str(self.data_dir),
            "--liste", csv_file_path,
            "--liste-key", primary_key,
            "--notes-id", code_name,
            "--encodage-liste", "UTF-8",
        ]
        self._run_amc(cmd, strict=True)

    def annotate_and_export(self, csv_file_path: str):
        """
        Bước 6: annotate + export
        Đọc cả 4 file sqlite trên -> sinh PDF chú thích điểm + CSV kết quả -> ghi log vào report.sqlite.
        """
        print(f"[{self.project_dir.name}] STEP 6: Running annotate and export")
        cmd_annotate = [
            "auto-multiple-choice", "annotate",
            "--projet", str(self.project_dir),
            "--data", str(self.data_dir),
            "--cr", str(self.cr_dir),
            "--noms-fichier", csv_file_path
        ]
        self._run_amc(cmd_annotate, strict=False)

        cmd_export = [
            "auto-multiple-choice", "export",
            "--projet", str(self.project_dir),
            "--data", str(self.data_dir),
            "--module", "CSV",
            "--fich-noms", csv_file_path,
            "--o", str(self.exports_dir / "results.csv")
        ]
        self._run_amc(cmd_export, strict=False)

    def anonymize(self, settings: dict):
        """
        Tạo các tệp PDF đã ẩn danh cho từng học sinh dựa trên các cài đặt ẩn danh hóa.
        """
        header_annotations = settings.get('header_annotations', '%(aID)')
        anonymous_id_model = settings.get('anonymous_id_model', 'edddds')
        

        self.anonymous_dir.mkdir(parents=True, exist_ok=True)
        cmd = [
            "auto-multiple-choice", "annotate",
            "--progression-id", "annotate",
            "--progression", "1",
            "--project", str(self.project_dir),
            "--data", str(self.data_dir),
            "--subject", str(self.project_dir / "DOC-sujet.pdf"),
            "--pdf-dir", str(self.anonymous_dir),
            "--filename-model", "(aID)",
            "--verdict", header_annotations,
            "--no-verdict-allpages",
            "--anonymous", anonymous_id_model,
            "--header-only",
            "--no-compose",
            "--changes-only", "1"
        ]
        print(f"[{self.project_dir.name}] Running anonymize: {' '.join(cmd)}")
        return self._run_amc(cmd)
    
    def import_external_scores(self, csv_file_path: str):
        """
        Nhập điểm số từ tệp CSV bên ngoài vào cơ sở dữ liệu điểm của dự án.
        """
        cmd = [
            "auto-multiple-choice", "external",
            "--data", str(self.data_dir),
            "--source", str(csv_file_path)
        ]

        print(f"[{self.project_dir.name}] Running anonymize: {' '.join(cmd)}")
        return self._run_amc(cmd)



if __name__ == "__main__":
    workspace_dir = os.path.dirname(os.path.abspath(__file__))
    projects_dir = os.path.join(workspace_dir, "MC-Projects")
    
    # Tạo project testing4
    proj = AMCProject(base_path=projects_dir, project_name="testing4")
    try:
        proj.create()
    except FileExistsError as e:
        print(e)

