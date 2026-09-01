module.exports = {
  apps: [{
    name: 'zhishi',
    script: 'server.js',
    max_memory_restart: '300M',
    // 日志限制
    max_size: '10M',
    retain: 3,
    // 磁盘 IO 保护：日志写到 stdout，由 pm2 管理
    out_file: '/dev/null',
    error_file: '/dev/null',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    // 启动参数
    env: {
      NODE_ENV: 'production',
      PORT: 3456,
      VISION_API_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      VISION_MODEL: 'qwen3.7-plus'
    }
  }]
};
