"""实机操作录屏 - 真实网站交互演示"""
import os, shutil, glob
from playwright.sync_api import sync_playwright

DIR = os.path.dirname(os.path.abspath(__file__))
SITE = "http://localhost:3003"
FRAMES = f"{DIR}/interactive_frames"
AUDIO = f"{DIR}/v3_narration_full.mp3"  # reuse existing narration
OUTPUT = f"{DIR}/douyin-interactive.mp4"
FFMPEG = "C:/Users/86132/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe"

os.makedirs(FRAMES, exist_ok=True)
for f in glob.glob(f"{FRAMES}/*.png"): os.remove(f)

W, H = 390, 844  # phone size
SCALE = 2  # retina quality
VW, VH = W * SCALE, H * SCALE  # 780x1688

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    def screenshot(frame_count):
        """Take screenshot and advance frame counter"""
        page.screenshot(path=f"{FRAMES}/f_{frame_count[0]:05d}.png")
        frame_count[0] += 1

    def wait(frames, fc):
        """Wait for N frames"""
        for _ in range(frames):
            page.wait_for_timeout(33)  # ~30fps
            screenshot(fc)

    fc = [0]

    # ====== SCENE 0: Brand intro (3s) ======
    page = browser.new_page(viewport={"width": VW, "height": VH}, device_scale_factor=1)
    page.goto(f"{SITE}/index.html", wait_until="networkidle")
    page.wait_for_timeout(1000)
    wait(90, fc)  # 3 seconds of hero page

    # ====== SCENE 1: Navigate to paipan (2s) ======
    page.goto(f"{SITE}/paipan.html", wait_until="networkidle")
    page.wait_for_timeout(500)
    wait(60, fc)

    # ====== SCENE 2: Fill in birth form (8s) ======
    # Use JS for reliable form filling
    page.evaluate("""
      document.getElementById('sYear').value = '2004';
      document.getElementById('sMonth').value = '3';
      document.getElementById('sDay').value = '28';
      document.getElementById('sHour').value = '5';
      document.querySelector("input[name='gender'][value='female']").checked = true;
    """)
    wait(40, fc)

    # Select province/city/district via JS
    page.evaluate("""
      document.getElementById('province').value = '河北省';
    """)
    page.wait_for_timeout(200)
    page.evaluate("""
      var p = document.getElementById('province').value;
      var cSel = document.getElementById('city');
      cSel.innerHTML = '<option value="">选择城市</option>';
      if(REGION_DATA && REGION_DATA[p]) {
        Object.keys(REGION_DATA[p]).forEach(function(c) {
          var o = document.createElement('option'); o.value = c; o.textContent = c; cSel.appendChild(o);
        });
      }
      cSel.value = '廊坊市';
      cSel.disabled = false;
    """)
    page.wait_for_timeout(200)
    page.evaluate("""
      var p = document.getElementById('province').value;
      var c = document.getElementById('city').value;
      var dSel = document.getElementById('district');
      dSel.innerHTML = '<option value="">选择区县</option>';
      if(REGION_DATA && REGION_DATA[p] && REGION_DATA[p][c]) {
        REGION_DATA[p][c].forEach(function(d) {
          var o = document.createElement('option'); o.value = d; o.textContent = d; dSel.appendChild(o);
        });
      }
      dSel.value = '霸州市';
      dSel.disabled = false;
    """)
    wait(40, fc)

    # Click submit (show the button press visually)
    try:
        page.click(".submit", force=True, timeout=3000)
    except: pass
    wait(30, fc)

    # ====== SCENE 3: Result page - navigate directly (12s) ======
    # Navigate directly with params since form submit may not work with JS-filled values
    page.goto(f"{SITE}/result.html?year=2004&month=3&day=28&hour=5&clock=9&gender=female&prov=河北省&city=廊坊市&dist=霸州市", wait_until="networkidle")
    page.wait_for_timeout(2000)
    wait(60, fc)  # show header + four pillars

    # Scroll down to show four pillars
    page.evaluate("window.scrollTo(0, 800)")
    wait(60, fc)

    # Show dayun
    page.evaluate("window.scrollTo(0, 1300)")
    wait(60, fc)

    # Click professional interpretation
    try:
        el = page.query_selector("#proSection .drawer-toggle")
        if el:
            el.click()
            page.wait_for_timeout(500)
    except: pass
    wait(90, fc)

    # Scroll to show pattern + yongji
    page.evaluate("window.scrollTo(0, 2200)")
    wait(90, fc)

    # ====== SCENE 4: AI Chat demo (10s) ======
    # Click AI FAB
    try:
        fab = page.query_selector("#aiFab")
        if fab:
            fab.click(force=True)
            page.wait_for_timeout(2000)
    except: pass
    wait(40, fc)

    # Type a question
    try:
        inp = page.query_selector("#aiInput")
        if inp:
            inp.click(force=True)
            inp.fill("我的喜用神是什么")
            page.wait_for_timeout(800)
    except: pass
    wait(40, fc)

    # Click send
    try:
        send = page.query_selector("#aiSendBtn")
        if send:
            send.click(force=True)
            page.wait_for_timeout(4000)
    except: pass
    wait(40, fc)

    # Close drawer
    try:
        page.evaluate("window._aiClose()")
    except: pass

    # ====== SCENE 5: Pricing page (3s) ======
    page.goto(f"{SITE}/pricing.html", wait_until="networkidle")
    page.wait_for_timeout(1000)
    page.evaluate("window.scrollTo(0, 200)")
    wait(90, fc)

    # ====== SCENE 6: Closing (2s) ======
    page.goto(f"{SITE}/index.html", wait_until="networkidle")
    page.wait_for_timeout(500)
    wait(60, fc)

    browser.close()
    print(f"Total frames: {fc[0]} (~{fc[0]/30:.0f}s)")

# Encode (no audio initially - user can add voice later)
print("Encoding video...")
if os.path.exists(AUDIO):
    cmd = f'"{FFMPEG}" -y -framerate 30 -i "{FRAMES}/f_%05d.png" -i "{AUDIO}" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -shortest "{OUTPUT}"'
else:
    cmd = f'"{FFMPEG}" -y -framerate 30 -i "{FRAMES}/f_%05d.png" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p "{OUTPUT}"'
ret = os.system(cmd)
if ret == 0:
    print(f"Done: {OUTPUT} ({os.path.getsize(OUTPUT)/1024/1024:.1f}MB)")
else:
    print(f"Error {ret}, frames kept at {FRAMES}")
