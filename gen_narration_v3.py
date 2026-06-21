"""生成 v3 配音 - 云扬(最有表现力男声) + 稍慢语速"""
import os

DIR = os.path.dirname(os.path.abspath(__file__))

scripts = [
  # (文本, 文件名)
  ('知时。知天时，见自己。千年东方易学智慧，AI辅助解读。', 4000),
  ('第一步，输入你的出生信息。公历农历双模式，精确到时辰分钟。系统自动进行真太阳时校正，基于寿星万年历，1900到2100年数据可追溯。', 7000),
  ('第二步，系统推算你的四柱八字。年柱以立春为界，月柱依节气而定，日柱精确计算，时柱用五鼠遁法。同时计算十神藏干纳音神煞。', 7000),
  ('通过得令、得地、得势三要素，系统量化评分判定日主旺衰。再以透干取格法确定命局格局，推演出专属你的喜用忌神。五行生克关系一目了然。', 7000),
  ('AI易学助手全程待命。融合传统子平法与盲派体系，引据古籍经典，DeepSeek驱动。支持白话和深度两种对话模式。提出你的问题，即刻获得专属解读。', 7000),
  ('知天时，见自己。即刻开始你的易学探索之旅。', 4000),
]

FFMPEG = 'C:/Users/86132/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe'

print("生成配音...")
files = []
for i, (text, dur) in enumerate(scripts):
    out = f'{DIR}/v3_narration_{i}.mp3'
    # zh-CN-YunyangNeural: 云扬, 最有表现力的男声, 适合新闻/纪录片风格
    cmd = f'edge-tts --voice zh-CN-YunyangNeural --rate=-10% --text "{text}" --write-media "{out}"'
    ret = os.system(cmd)
    if ret == 0:
        files.append(out)
        print(f'  [{i+1}/{len(scripts)}] {out}')
    else:
        print(f'  [{i+1}/{len(scripts)}] FAILED')

# Merge
if len(files) == len(scripts):
    parts = '|'.join(files)
    out_full = f'{DIR}/v3_narration_full.mp3'
    cmd = f'"{FFMPEG}" -y -i "concat:{parts}" -acodec copy "{out_full}"'
    os.system(cmd)
    size = os.path.getsize(out_full)
    print(f'\nMerged: {out_full} ({size/1024:.0f}KB)')
else:
    print(f'\nOnly {len(files)}/{len(scripts)} generated, skipping merge')
