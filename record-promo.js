// 抖音宣传视频录制脚本
// 用法: node record-promo.js
// 输出: douyin-promo.mp4 (1080x1920, ~35秒)

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const OUTPUT = path.join(__dirname, 'douyin-promo.mp4');
  const HTML = path.join(__dirname, 'douyin-promo.html');
  const url = 'file:///' + HTML.replace(/\\/g, '/');

  console.log('启动浏览器...');
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 2,
    recordVideo: {
      dir: __dirname,
      size: { width: 1080, height: 1920 }
    }
  });

  const page = await context.newPage();
  console.log('加载演示页...');
  await page.goto(url, { waitUntil: 'networkidle' });

  // 等待所有幻灯片播放完毕
  // durations: [4000,5000,6000,5000,4000] = 24000ms + 转场时间
  const totalWait = 28000; // ~28秒
  console.log('录制中... (' + totalWait/1000 + '秒)');
  await page.waitForTimeout(totalWait);

  console.log('保存视频...');
  await context.close();
  await browser.close();

  // Playwright generates a .webm file, rename to .mp4
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.webm'));
  if (files.length > 0) {
    const webm = path.join(__dirname, files[0]);
    if (fs.existsSync(OUTPUT)) fs.unlinkSync(OUTPUT);
    fs.renameSync(webm, OUTPUT);
    console.log('✅ 视频已生成: ' + OUTPUT);
    console.log('   大小: ' + (fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1) + ' MB');
  } else {
    console.log('❌ 未找到输出文件。检查目录:', __dirname);
    console.log('   文件列表:', fs.readdirSync(__dirname).filter(f => f.includes('video') || f.includes('webm')));
  }
})();
