# PAT01 单盘复跑汇总（2026-08-14，GPT 终局裁决后）

> 回归批中 PAT01 犯 E1「寅巳午三会火局之势」（三会火应巳午未）。终局裁决：prompt 事实锁③加固 + hard-error V2 定向自修正兜底，两者均已部署（befb8e5）。
> 本脚本只复跑 PAT01（癸亥 甲寅 戊辰 丁巳）。线上真实调用 zhishi.online /api/ai-chat（生产 DeepSeek），mode=pro，新会话首问（history=[]），qa_debug 透出 V1 warnings + v2_applied。
> 测试兑换码 AISMOKE05（qa 专用，额度 2 防 hangup 双扣），调用完成后已删除；chat_history 证据行保留。
> 验证四点：①A层硬约束仍全守（中和45/七杀格成格/用火喜火土忌木金水） ②不再出现「寅巳午三会火」 ③若初稿再犯 hard E1，validator 能触发 V2 并正确修复（v2_applied=true） ④V2 不改冻结结论。

| 盘 | 状态 | 回复长度 | 剩余额度 | DB行数 | 保存一致 | validator | v2_applied |
|---|---|---|---|---|---|---|---|
| PAT01 | OK | 3355 | 1 | 2 | ✅ | 1 | 未触发 |
