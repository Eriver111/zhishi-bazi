"""录制 v2 宣传视频"""
import os, glob, shutil
from playwright.sync_api import sync_playwright

DIR = os.path.dirname(os.path.abspath(__file__))
HTML = f"file:///{DIR}/douyin-promo-v2.html"
FRAMES = f"{DIR}/promo_frames_v2"
AUDIO = f"{DIR}/promo_narration_full.mp3"
OUTPUT = f"{DIR}/douyin-promo-v2.mp4"
FFMPEG = "C:/Users/86132/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe"

os.makedirs(FRAMES, exist_ok=True)
for f in glob.glob(f"{FRAMES}/*.png"):
    os.remove(f)

print("启动浏览器...")
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
    page.goto(HTML, wait_until="networkidle")
    page.wait_for_timeout(1500)

    fps, duration = 30, 28
    total = fps * duration
    interval = 1.0 / fps

    print(f"录制: {duration}s {fps}fps = {total}帧")
    for i in range(total):
        page.screenshot(path=f"{FRAMES}/f_{i:05d}.png")
        page.wait_for_timeout(interval * 1000)
        if i % 120 == 0:
            print(f"  {i}/{total} ({i*100//total}%)")

    browser.close()

print(f"编码视频... frames in {FRAMES}")
os.chdir(DIR)
cmd = (f'"{FFMPEG}" -y -framerate {fps} -i "{FRAMES}/f_%05d.png" '
       f'-i "{AUDIO}" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p '
       f'-c:a aac -b:a 128k -shortest "{OUTPUT}"')
print(f"CMD: {cmd[:200]}...")
ret = os.system(cmd)
if ret == 0:
    size = os.path.getsize(OUTPUT) / 1024 / 1024
    print(f"Done: {OUTPUT} ({size:.1f}MB)")
else:
    print(f"FFmpeg error (code {ret}), frames kept at {FRAMES}")

# shutil.rmtree(FRAMES, ignore_errors=True)
