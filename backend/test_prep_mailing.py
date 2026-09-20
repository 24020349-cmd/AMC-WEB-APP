import unittest
from unittest.mock import patch, MagicMock
import sqlite3
import tempfile
import shutil
from pathlib import Path
import json
import fitz  # PyMuPDF
import email
from email.header import decode_header

import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from api.routers.projects import (
    preview_prep_mailing,
    send_prep_mailing,
    extract_student_subject_pdf,
    MailingSendRequest,
)
import api.routers.projects as proj_router
from fastapi import HTTPException

class TestPreparationMailing(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.project_name = "prep_mail_proj"
        self.proj_dir = Path(self.test_dir) / self.project_name
        self.proj_dir.mkdir(parents=True, exist_ok=True)
        (self.proj_dir / "data").mkdir(exist_ok=True)

        self.orig_root = proj_router.PROJECTS_ROOT
        proj_router.PROJECTS_ROOT = Path(self.test_dir)

    def tearDown(self):
        proj_router.PROJECTS_ROOT = self.orig_root
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_prep_mailing_prerequisite_no_sender(self):
        with patch.object(proj_router, 'load_settings', return_value={"email_sender": ""}):
            data = preview_prep_mailing(self.project_name, csv_file="list.csv", primary_key="id")
            self.assertEqual(data["status"], "error")
            self.assertEqual(data["code"], "INVALID_SENDER_EMAIL")

    def test_prep_mailing_prerequisite_no_sujet(self):
        with patch.object(proj_router, 'load_settings', return_value={"email_sender": "teacher@domain.com"}):
            data = preview_prep_mailing(self.project_name, csv_file="list.csv", primary_key="id")
            self.assertEqual(data["status"], "error")
            self.assertEqual(data["code"], "NO_SUBJECT_PDF")

    def test_project_status_and_auto_resolve_csv(self):
        # Initial status: no PDF, no layout, no csv
        status = proj_router.get_project_status(self.project_name)
        self.assertFalse(status["has_compiled"])
        self.assertFalse(status["has_detected"])
        self.assertIsNone(status["default_csv"])

        # Create DOC-sujet.pdf & list.csv
        (self.proj_dir / "DOC-sujet.pdf").write_bytes(b"%PDF-1.4 dummy")
        (self.proj_dir / "list.csv").write_text("id,name,email\n1,An,an@gmail.com\n", encoding="utf-8")

        status2 = proj_router.get_project_status(self.project_name)
        self.assertTrue(status2["has_compiled"])
        self.assertEqual(status2["default_csv"], "list.csv")

        # Test preview with csv_file=None (auto resolution)
        layout_db = self.proj_dir / "data" / "layout.sqlite"
        lconn = sqlite3.connect(layout_db)
        lconn.execute("CREATE TABLE layout_page (student INTEGER, page INTEGER, copy INTEGER, subjectpage INTEGER)")
        lconn.execute("INSERT INTO layout_page VALUES (1, 1, 0, 1)")
        lconn.commit()
        lconn.close()

        with patch.object(proj_router, 'load_settings', return_value={"email_sender": "teacher@domain.com"}):
            preview = preview_prep_mailing(self.project_name, csv_file=None, primary_key=None)
            self.assertEqual(preview["status"], "ok")
            self.assertEqual(preview["csv_file"], "list.csv")
            self.assertEqual(preview["primary_key"], "id")
            self.assertEqual(len(preview["students"]), 1)

    def test_prep_mailing_preview_and_send(self):
        # 1. Create a dummy DOC-sujet.pdf with 2 pages
        doc = fitz.open()
        p1 = doc.new_page()
        p1.insert_text((50, 50), "Question sheet for Student 1 - Page 1")
        p2 = doc.new_page()
        p2.insert_text((50, 50), "Question sheet for Student 2 - Page 1")
        doc.save(str(self.proj_dir / "DOC-sujet.pdf"))
        doc.close()

        # 2. Create layout.sqlite with layout_page
        layout_db = self.proj_dir / "data" / "layout.sqlite"
        lconn = sqlite3.connect(layout_db)
        lconn.execute("CREATE TABLE layout_page (student INTEGER, page INTEGER, copy INTEGER, subjectpage INTEGER)")
        # Student 1 gets subjectpage 1, Student 2 gets subjectpage 2
        lconn.execute("INSERT INTO layout_page VALUES (1, 1, 0, 1)")
        lconn.execute("INSERT INTO layout_page VALUES (2, 1, 0, 2)")
        lconn.commit()
        lconn.close()

        # 3. Create students CSV
        csv_file = self.proj_dir / "list.csv"
        csv_file.write_text("id,name,email\n1,Nguyen Van A,vana@gmail.com\n2,Tran Thi B,thib@gmail.com\n", encoding="utf-8")

        # 4. Test Preview
        with patch.object(proj_router, 'load_settings', return_value={
            "email_sender": "teacher@domain.com",
            "df_subjectemail_email_subject": "Đề thi %n",
            "df_subjectemail_email_text": "Chào %(name),\nĐây là đề thi của em."
        }):
            data = preview_prep_mailing(self.project_name, csv_file="list.csv", primary_key="id")
            self.assertEqual(data["status"], "ok")
            self.assertEqual(data["mode"], "subject")
            self.assertEqual(data["default_subject"], "Đề thi %n")
            self.assertEqual(len(data["students"]), 2)
            self.assertEqual(data["students"][0]["name"], "Nguyen Van A")
            self.assertEqual(data["students"][0]["email"], "vana@gmail.com")

        # 5. Test Send
        with patch('smtplib.SMTP_SSL') as mock_smtp_ssl:
            mock_server = MagicMock()
            mock_smtp_ssl.return_value = mock_server

            with patch.object(proj_router, 'load_settings', return_value={
                "email_sender": "teacher@domain.com",
                "email_smtp_host": "smtp.gmail.com",
                "email_smtp_port": 465,
                "email_smtp_ssl": "SSL",
                "email_smtp_user": "teacher@gmail.com",
                "email_smtp_password": "apppassword",
                "email_delay": 0.0,
                "df_subjectemail_email_subject": "Exam question",
                "df_subjectemail_email_text": "Please find enclosed your question sheet."
            }):
                payload = {
                    "csv_file": "list.csv",
                    "primary_key": "id",
                    "email_col": "email",
                    "exam_name": "Math Test",
                    "subject": "Đề thi môn %n",
                    "body": "Chào %(name),\nEm nhận đề thi file đính kèm nhé.",
                    "use_html": False,
                    "selected_exams": [1, 2],
                    "attachments": []
                }
                send_data = send_prep_mailing(self.project_name, MailingSendRequest(**payload))
                self.assertTrue(send_data["success"])
                self.assertEqual(send_data["sent_count"], 2)
                self.assertEqual(send_data["failed_count"], 0)

                # Check sliced files exist in cr/subject/
                subj1 = self.proj_dir / "cr" / "subject" / "subject-1.pdf"
                subj2 = self.proj_dir / "cr" / "subject" / "subject-2.pdf"
                self.assertTrue(subj1.exists())
                self.assertTrue(subj2.exists())

                # Check PyMuPDF sliced page content
                d1 = fitz.open(str(subj1))
                self.assertEqual(len(d1), 1)
                text1 = d1[0].get_text()
                self.assertIn("Question sheet for Student 1", text1)
                d1.close()

                # Check report.sqlite has type=3 records
                rep_db = self.proj_dir / "data" / "report.sqlite"
                rconn = sqlite3.connect(rep_db)
                rows = rconn.execute("SELECT student, type, mail_status FROM report_student ORDER BY student").fetchall()
                rconn.close()
                self.assertEqual(len(rows), 2)
                self.assertEqual(rows[0], (1, 3, 1)) # type=3 (REPORT_PRINTED_COPY), status=1 (REPORT_MAIL_OK)
                self.assertEqual(rows[1], (2, 3, 1))

                # Check mock smtp sendmail calls
                self.assertEqual(mock_server.sendmail.call_count, 2)
                
                # Check email attachment filename is subject.pdf
                first_call_args = mock_server.sendmail.call_args_list[0][0]
                first_msg_str = first_call_args[2]
                parsed_msg = email.message_from_string(first_msg_str)
                attachment_filenames = [part.get_filename() for part in parsed_msg.walk() if part.get_filename()]
                self.assertIn("subject.pdf", attachment_filenames)

    def test_reports_mailing_preview_and_send(self):
        # Create dummy annotated PDF
        (self.proj_dir / "cr" / "corrections" / "pdf").mkdir(parents=True, exist_ok=True)
        pdf_file = self.proj_dir / "cr" / "corrections" / "pdf" / "annotated-1-1.pdf"
        pdf_file.write_bytes(b"%PDF-1.4 " + b"A" * 600)

        # Create CSV
        csv_file = self.proj_dir / "list.csv"
        csv_file.write_text("id,name,email\n1,Nguyen Van A,vana@gmail.com\n", encoding="utf-8")

        # Create association sqlite
        assoc_db = self.proj_dir / "data" / "association.sqlite"
        conn = sqlite3.connect(assoc_db)
        conn.execute("CREATE TABLE association_variables (name TEXT, value TEXT)")
        conn.execute("INSERT INTO association_variables VALUES ('key_in_list', 'id'), ('code', 'student')")
        conn.execute("CREATE TABLE association_association (student INTEGER, copy INTEGER, auto TEXT, manual TEXT)")
        conn.execute("INSERT INTO association_association VALUES (1, 0, '1', NULL)")
        conn.commit()
        conn.close()

        # Create capture sqlite
        cap_db = self.proj_dir / "data" / "capture.sqlite"
        cconn = sqlite3.connect(cap_db)
        cconn.execute("CREATE TABLE capture_page (student INTEGER, page INTEGER, copy INTEGER, mse REAL, timestamp_auto INTEGER, src TEXT)")
        cconn.execute("INSERT INTO capture_page VALUES (1, 1, 0, 0.0, 1000, 'scan.jpg')")
        cconn.commit()
        cconn.close()

        # Create scoring sqlite
        score_db = self.proj_dir / "data" / "scoring.sqlite"
        sconn = sqlite3.connect(score_db)
        sconn.execute("CREATE TABLE scoring_variables (name TEXT, value TEXT)")
        sconn.execute("INSERT INTO scoring_variables VALUES ('mark_max', '10.0')")
        sconn.execute("CREATE TABLE scoring_mark (student INTEGER, copy INTEGER, mark REAL, total REAL, max REAL)")
        sconn.execute("INSERT INTO scoring_mark VALUES (1, 0, 8.5, 17.0, 20.0)")
        sconn.commit()
        sconn.close()

        # Test preview
        with patch.object(proj_router, 'load_settings', return_value={
            "email_sender": "teacher@domain.com",
            "df_annotatedemail_email_subject": "Result %n",
            "df_annotatedemail_email_text": "Hi %(name), score %s/%m"
        }):
            preview = proj_router.preview_report_mailing(self.project_name, csv_file="list.csv", primary_key="id")
            self.assertEqual(preview["status"], "ok")
            self.assertEqual(len(preview["students"]), 1)
            self.assertEqual(preview["students"][0]["mark"], 8.5)

        # Test send
        with patch('smtplib.SMTP_SSL') as mock_smtp_ssl:
            mock_server = MagicMock()
            mock_smtp_ssl.return_value = mock_server

            with patch.object(proj_router, 'load_settings', return_value={
                "email_sender": "teacher@domain.com",
                "email_smtp_host": "smtp.gmail.com",
                "email_smtp_port": 465,
                "email_smtp_ssl": "SSL",
                "email_smtp_user": "teacher@gmail.com",
                "email_smtp_password": "apppassword",
                "email_delay": 0.0,
                "df_annotatedemail_email_subject": "Exam Result",
                "df_annotatedemail_email_text": "Hello"
            }):
                payload = {
                    "csv_file": "list.csv",
                    "primary_key": "id",
                    "email_col": "email",
                    "exam_name": "Midterm Exam",
                    "subject": "Kết quả %n",
                    "body": "Chào %(name), điểm %s/%m",
                    "use_html": False,
                    "selected_exams": [1],
                    "attachments": []
                }
                send_data = proj_router.send_report_mailing(self.project_name, MailingSendRequest(**payload))
                self.assertTrue(send_data["success"])
                self.assertEqual(send_data["sent_count"], 1)

                # Check report.sqlite has type=1
                rep_db = self.proj_dir / "data" / "report.sqlite"
                rconn = sqlite3.connect(rep_db)
                row = rconn.execute("SELECT student, type, mail_status FROM report_student WHERE student=1 AND type=1").fetchone()
                rconn.close()
                self.assertEqual(row, (1, 1, 1))

if __name__ == '__main__':
    unittest.main()
