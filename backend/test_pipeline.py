import unittest
from unittest.mock import patch
import os
import shutil
from pathlib import Path
from project import AMCProject

class TestAMCPipeline(unittest.TestCase):
    def setUp(self):
        self.workspace_dir = os.path.dirname(os.path.abspath(__file__))
        self.test_projects_dir = os.path.join(self.workspace_dir, "Test-Projects")
        self.project_name = "test_project"
        self.proj = AMCProject(base_path=self.test_projects_dir, project_name=self.project_name)

    def tearDown(self):
        # Dọn dẹp: Xóa thư mục test_projects_dir sau khi test xong để đảm bảo source code sạch sẽ
        if os.path.exists(self.test_projects_dir):
            shutil.rmtree(self.test_projects_dir)

    def test_project_creation(self):
        """Test việc khởi tạo cấu trúc thư mục AMC"""
        self.proj.create()
        
        # Kiểm tra xem các thư mục đã được tạo chưa
        self.assertTrue(self.proj.project_dir.exists())
        self.assertTrue(self.proj.data_dir.exists())
        self.assertTrue(self.proj.cr_dir.exists())
        self.assertTrue(self.proj.scans_dir.exists())
        self.assertTrue(self.proj.exports_dir.exists())
        self.assertTrue(self.proj.build_dir.exists())
        self.assertTrue(self.proj.anonymous_dir.exists())
        
        # Kiểm tra các file xml
        self.assertTrue((self.proj.project_dir / "description.xml").exists())
        self.assertTrue((self.proj.project_dir / "options.xml").exists())

    @patch('subprocess.run')
    def test_pipeline_execution(self, mock_subprocess):
        """Test quy trình pipeline chuẩn (gọi các lệnh shell CLI)"""
        self.proj.create()
        
        # Tạo file fake dummy
        tex_file = str(self.proj.project_dir / "source.tex")
        with open(tex_file, 'w') as f:
            f.write("dummy latex")
            
        csv_file = str(self.proj.project_dir / "students.csv")
        with open(csv_file, 'w') as f:
            f.write("id,name\n1,Test")

        # Tạo file dummy cho scans để analyse() quét thấy file
        dummy_scan = self.proj.scans_dir / "scan1.pdf"
        with open(dummy_scan, 'w') as f:
            f.write("dummy pdf")
            
        # STEP 1: prepare
        self.proj.prepare(tex_file)
        self.assertEqual(mock_subprocess.call_count, 2) # Mode S and Mode B
        
        # STEP 2: meptex
        self.proj.meptex()
        self.assertEqual(mock_subprocess.call_count, 3)
        
        # STEP 3: analyse
        self.proj.analyse()
        self.assertEqual(mock_subprocess.call_count, 4)
        # Verify analyse scan files argument
        args, kwargs = mock_subprocess.call_args
        self.assertIn(str(dummy_scan), args[0])
        
        # STEP 4: note
        self.proj.note()
        self.assertEqual(mock_subprocess.call_count, 5)
        
        # STEP 5: association_auto
        self.proj.association_auto(csv_file)
        self.assertEqual(mock_subprocess.call_count, 6)
        
        # STEP 6: annotate and export
        self.proj.annotate_and_export(csv_file)
        self.assertEqual(mock_subprocess.call_count, 8) # annotate and export
        
        # Verify no bugs
        print("Pipeline test completed successfully with no bugs.")

if __name__ == '__main__':
    unittest.main()
