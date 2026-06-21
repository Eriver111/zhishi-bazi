"""截取网站关键页面实机图"""
from playwright.sync_api import sync_playwright
import os

DIR = os.path.dirname(os.path.abspath(__file__))
SITE = "http://localhost:3003"
os.makedirs(f"{DIR}/promo_screenshots", exist_ok=True)

pages = [
    {"name": "01_paipan", "url": f"{SITE}/paipan.html", "desc": "排盘输入页"},
    {"name": "02_result_top", "url": f"{SITE}/result.html?year=2004&month=3&day=28&hour=5&clock=9&gender=female&prov=河北省&city=廊坊市&dist=霸州市", "desc": "结果页-四柱盘面"},
    {"name": "03_result_pro", "url": f"{SITE}/result.html?year=2004&month=3&day=28&hour=5&clock=9&gender=female&prov=河北省&city=廊坊市&dist=霸州市#pro", "desc": "结果页-专业解读"},
    {"name": "04_pricing", "url": f"{SITE}/pricing.html", "desc": "积分方案页"},
    {"name": "05_index", "url": f"{SITE}/", "desc": "首页"},
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for item in pages:
        print(f"截图: {item['desc']}")
        page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        page.goto(item["url"], wait_until="networkidle", timeout=15000)
        page.wait_for_timeout(2000)
        # 如果有专业解读，滚动到可见区域
        if "pro" in item["name"]:
            try:
                el = page.query_selector("#proSection")
                if el:
                    el.click()
                    page.wait_for_timeout(1000)
            except: pass
        page.screenshot(path=f"{DIR}/promo_screenshots/{item['name']}.png", full_page=False)
        page.close()
    browser.close()

print("全部截图完成!")
for f in sorted(os.listdir(f"{DIR}/promo_screenshots")):
    size = os.path.getsize(f"{DIR}/promo_screenshots/{f}") / 1024
    print(f"  {f} ({size:.0f}KB)")
