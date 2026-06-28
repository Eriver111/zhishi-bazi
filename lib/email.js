/**
 * 邮件发送模块 — 阿里云 DirectMail HTTP API（无 SDK 依赖）
 * v2.0
 */
const crypto = require('crypto');

const AK_ID = process.env.ALI_AK_ID || '';
const AK_SECRET = process.env.ALI_AK_SECRET || '';
const FROM_ADDR = process.env.MAIL_FROM || 'noreply@mail.zhishi.online';
const SITE_DOMAIN = (process.env.SITE_URL || 'https://zhishi.online').replace(/^https?:\/\//, '');

function buildHTML(code) {
  return '<div style="max-width:480px;margin:0 auto;padding:32px 24px;font-family:Arial,Helvetica,sans-serif;background:#f9f9f5;border-radius:12px">'
    + '<div style="text-align:center;font-size:28px;font-weight:900;color:#8a7030;letter-spacing:6px;margin-bottom:16px">知 时</div>'
    + '<div style="text-align:center;font-size:14px;color:#6a6050;margin-bottom:24px">邮箱验证码</div>'
    + '<div style="text-align:center;background:#fff;border:2px dashed #d8c060;border-radius:10px;padding:20px;margin:16px 0">'
    + '<span style="font-size:36px;font-weight:900;color:#8a7030;letter-spacing:8px;font-family:monospace">' + code + '</span>'
    + '</div>'
    + '<div style="text-align:center;font-size:12px;color:#a0a090;margin-top:16px">验证码 5 分钟内有效，请勿转发给他人</div>'
    + '<div style="text-align:center;font-size:10px;color:#c0c0b0;margin-top:24px;padding-top:16px;border-top:1px solid #e8e8e0">此邮件由知时（' + SITE_DOMAIN + '）自动发送，无需回复</div>'
    + '</div>';
}

function percentEncode(str) {
  var s = String(str);
  return encodeURIComponent(s)
    .replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28')
    .replace(/\)/g, '%29').replace(/\*/g, '%2A');
  // 注意：不把 %20 替换为 +（阿里云要求空格编码为 %20 而非 +）
}

function sign(params, secret) {
  var keys = Object.keys(params).sort();
  var qs = keys.map(function(k) {
    return percentEncode(k) + '=' + percentEncode(String(params[k]));
  }).join('&');
  var stringToSign = 'POST&' + percentEncode('/') + '&' + percentEncode(qs);
  return crypto.createHmac('sha1', secret + '&').update(stringToSign).digest('base64');
}

async function sendCode(toEmail, code) {
  var pubParams = {
    Format: 'JSON',
    Version: '2015-11-23',
    SignatureMethod: 'HMAC-SHA1',
    SignatureVersion: '1.0',
    SignatureNonce: crypto.randomUUID(),
    Timestamp: new Date().toISOString().replace(/\.\d{3}/, ''),
    AccessKeyId: AK_ID,
    Action: 'SingleSendMail',
    AccountName: FROM_ADDR,
    AddressType: '1',
    ReplyToAddress: 'false',
    ToAddress: toEmail,
    Subject: '知时 - 邮箱验证码',
    HtmlBody: buildHTML(code)
  };

  pubParams.Signature = sign(pubParams, AK_SECRET);

  // 构建请求体：用 percentEncode 保证与签名编码一致（空格→%20 不是 +）
  var body = Object.keys(pubParams).map(function(k) {
    return percentEncode(k) + '=' + percentEncode(String(pubParams[k]));
  }).join('&');

  var resp = await fetch('https://dm.aliyuncs.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body
  });
  var text = await resp.text();
  var data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('DM 响应解析失败: ' + text); }

  if (data.Code || (data.RequestId && !data.EnvId)) {
    throw new Error((data.Code || 'Unknown') + ': ' + (data.Message || text));
  }
  console.log('DM sent OK to:', toEmail);
  return data;
}

module.exports = { sendCode };
