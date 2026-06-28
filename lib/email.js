/**
 * 邮件发送模块 — 阿里云 DirectMail HTTP API
 * v2.1
 */
const crypto = require('crypto');

const AK_ID = process.env.ALI_AK_ID || '';
const AK_SECRET = process.env.ALI_AK_SECRET || '';
const FROM_ADDR = process.env.MAIL_FROM || 'noreply@mail.zhishi.online';
const SITE_DOMAIN = (process.env.SITE_URL || 'https://zhishi.online').replace(/^https?:\/\//, '');

function buildHTML(code) {
  var verifyUrl = (process.env.SITE_URL || 'https://zhishi.online') + '/verify?code=' + encodeURIComponent(code) + '&email=';
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
  return encodeURIComponent(s).replace(/!/g,'%21').replace(/'/g,'%27').replace(/\(/g,'%28').replace(/\)/g,'%29').replace(/\*/g,'%2A');
}

function sign(params, secret) {
  var keys = Object.keys(params).sort();
  var qs = keys.map(function(k){ return percentEncode(k)+'='+percentEncode(String(params[k])); }).join('&');
  return crypto.createHmac('sha1', secret+'&').update('POST&'+percentEncode('/')+'&'+percentEncode(qs)).digest('base64');
}

async function sendCode(toEmail, code) {
  var pubParams = {
    Format:'JSON', Version:'2015-11-23', SignatureMethod:'HMAC-SHA1', SignatureVersion:'1.0',
    SignatureNonce: crypto.randomUUID(),
    Timestamp: new Date().toISOString().replace(/\.\d{3}/,''),
    AccessKeyId: AK_ID, Action:'SingleSendMail',
    AccountName: FROM_ADDR, AddressType:'1', ReplyToAddress:'false',
    ToAddress: toEmail, Subject:'知时 - 邮箱验证码', HtmlBody: buildHTML(code)
  };
  pubParams.Signature = sign(pubParams, AK_SECRET);
  var body = Object.keys(pubParams).map(function(k){ return percentEncode(k)+'='+percentEncode(String(pubParams[k])); }).join('&');

  var resp = await fetch('https://dm.aliyuncs.com/', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: body });
  var text = await resp.text();
  console.log('DM HTTP',resp.status,'Len:',text.length,'Body:',text.slice(0,300));
  if (!text||!text.trim()) throw new Error('DM空响应(status='+resp.status+')，AK可能无效');
  var data;
  try { data = JSON.parse(text); } catch(e) { throw new Error('DM JSON解析失败: '+text.slice(0,200)); }
  if (data.Code) throw new Error(data.Code+': '+(data.Message||text.slice(0,100)));
  console.log('DM sent OK:', toEmail);
  return data;
}

module.exports = { sendCode };
