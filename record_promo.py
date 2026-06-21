"""抖音宣传视频自动录制脚本"""
import os, time, glob
from playwright.sync_api import sync_playwright

DIR = os.path.dirname(os.path.abspath(__file__))
HTML = f"file:///{DIR}/douyin-promo.html"
FRAMES_DIR = os.path.join(DIR, "promo_frames")
AUDIO = os.path.join(DIR, "narration_full.mp3")
OUTPUT = os.path.join(DIR, "douyin-promo.mp4")
FFMPEG = "C:/Users/86132/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe"

os.makedirs(FRAMES_DIR, exist_ok=True)
# Clean old frames
for f in glob.glob(f"{FRAMES_DIR}/*.png"):
    os.remove(f)

print("启动浏览器...")
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
    page.goto(HTML, wait_until="networkidle")

    # 等待初始动画
    page.wait_for_timeout(1000)

    # 录制 30 秒，30fps = 900 帧
    fps = 30
    duration = 30  # seconds
    total_frames = fps * duration
    interval = 1.0 / fps

    print(f"录制中... {duration}秒 {fps}fps = {total_frames}帧")
    for i in range(total_frames):
        frame_path = os.path.join(FRAMES_DIR, f"frame_{i:05d}.png")
        page.screenshot(path=frame_path)
        page.wait_for_timeout(interval * 1000)
        if i % 60 == 0:
            print(f"  进度: {i}/{total_frames} ({i*100//total_frames}%)")

    browser.close()

print("截图完成。编码视频...")
# ffmpeg: images → video + audio
cmd = (
    f'"{FFMPEG}" -y -framerate {fps} -i "{FRAMES_DIR}/frame_%05d.png" '
    f'-i "{AUDIO}" '
    f'-c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p '
    f'-c:a aac -b:a 128k -shortest '
    f'-vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" '
    f'"{OUTPUT}"'
)
print(cmd)
ret = os.system(cmd)
if ret == 0:
    size_mb = os.path.getsize(OUTPUT) / 1024 / 1024
    print(f"✅ 视频已生成: {OUTPUT} ({size_mb:.1f} MB)")
else:
    print(f"❌ ffmpeg 编码失败 (code {ret})")

# 清理帧文件
import shutil
shutil.rmtree(FRAMES_DIR, ignore_errors=True)
print("完成!")
