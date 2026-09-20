import cv2 as cv
import numpy as np 
import os
import time


def image_transform(img: np.array, markers_coordinates: list[list[float]]) -> np.array:
    # Read Image
    standard_width = 1240
    standard_height = 1754
    padding = 60

    dst_pts = np.float32([
        [padding, padding],
        [standard_width - padding, padding],
        [standard_width - padding, standard_height - padding],
        [padding, standard_height - padding]
    ])

    M = cv.getPerspectiveTransform(np.array(markers_coordinates), dst_pts)
    warped = cv.warpPerspective(img, M, (standard_width, standard_height), borderMode=cv.BORDER_CONSTANT, borderValue=(255, 255, 255))
    return warped 

def image_thresholding(img: np.array) -> np.array:
    gray_img = cv.cvtColor(img, cv.COLOR_BGR2GRAY)
    gray_img = cv.GaussianBlur(gray_img, (5, 5), 0)

    thresh = cv.adaptiveThreshold(gray_img, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2)
    
    return thresh

def store_scans(img_list: list[np.array], scans_dir: str):
    img_list_copy = img_list.copy()
    if len(img_list) == 0:
        print("No image to store!")
        return
    batch_id = int(time.time())


    for idx, img in enumerate(img_list_copy):
        filename = f"scan_{batch_id}_{idx+1}.png"
        output_path = os.path.join(scans_dir, filename)

        success = cv.imwrite(output_path, img)
        if success:
            print(f"Saved successfully: {output_path}")
        else:
            print(f"Failed to save: {output_path}")

    
