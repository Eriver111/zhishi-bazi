# PAT04 表达专项单盘重跑汇总（2026-08-14）

> 回归批中 PAT04 因 TH07 socket hangup 双扣积分致额度耗尽而失败，本脚本单盘补跑。
> 线上真实调用 zhishi.online /api/ai-chat（生产 DeepSeek），mode=pro，新会话首问（history=[]），qa_debug 透出 V1 validator warnings。
> 测试兑换码 AISMOKE04（qa 专用，额度 2 防 hangup 双扣），调用完成后已删除；chat_history 证据行保留。
> 验证点：火忌表达是否被新 prompt（事实锁 6 条）过度纠正。

| 盘 | 状态 | 回复长度 | 剩余额度 | DB行数 | 保存一致 | validator |
|---|---|---|---|---|---|---|
| PAT04 | OK | 3576 | 1 | 2 | ✅ | 0 |
