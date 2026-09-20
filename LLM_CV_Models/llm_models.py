import os
os.environ['KMP_DUPLICATE_LIB_OK'] = 'True'
from ultralytics import YOLO

def main():
    model = YOLO('yolov8n.pt')

    results = model.train(
        data = 'AMC-WEB-APP.v1-2026-8-19-.yolov8(1)/data.yaml',
        epochs = 100,
        imgsz = 640,
        batch = 16,
        device = 'cpu'
    )

if __name__ == '__main__':
    main()
