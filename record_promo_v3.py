"""录制 v3 宣传视频 - 数据演示版"""
import os, glob, shutil
from playwright.sync_api import sync_playwright

DIR = os.path.dirname(os.path.abspath(__file__))
HTML = f"file:///{DIR}/douyin-promo-v3.html"
AUDIO = f"{DIR}/v3_narration_full.mp3"
OUTPUT = f"{DIR}/douyin-promo-v3.mp4"
FFMPEG = "C:/Users/86132/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe"
FRAMES = f"{DIR}/v3_frames"
os.makedirs(FRAMES, exist_ok=True)

print("录制 v3...")
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width":1080,"height":1920}, device_scale_factor=1)
    page.goto(HTML, wait_until="networkidle")
    page.wait_for_timeout(1500)
    fps, dur = 30, 44
    total = fps * dur
    for i in range(total):
        page.screenshot(path=f"{FRAMES}/v3_{i:05d}.png")
        page.wait_for_timeout(1000//fps)
        if i%150==0: print(f"  {i}/{total}")
    browser.close()

print("编码...")
os.chdir(DIR)
cmd = f'"{FFMPEG}" -y -framerate {fps} -i "{FRAMES}/v3_%05d.png" -i "{AUDIO}" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -shortest "{OUTPUT}"'
ret = os.system(cmd)
if ret == 0:
    print(f"Done: {OUTPUT} ({os.path.getsize(OUTPUT)/1024/1024:.1f}MB)")
else:
    print(f"FFmpeg error {ret}")
shutil.rmtree(FRAMES, ignore_errors=True)
