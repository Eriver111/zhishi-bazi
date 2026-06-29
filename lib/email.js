/**
 * 邮件发送模块 — 阿里云 DirectMail HTTP API
 * v2.1
 */
const crypto = require('crypto');

const AK_ID = process.env.ALI_AK_ID || '';
const AK_SECRET = process.env.ALI_AK_SECRET || '';
const FROM_ADDR = process.env.MAIL_FROM || 'noreply@mail.zhishi.online';
const SITE_DOMAIN = (process.env.SITE_URL || 'https://zhishi.online').replace(/^https?:\/\//, '');

function buildHTML(code, email) {
  var verifyUrl = (process.env.SITE_URL || 'https://zhishi.online') + '/verify?code=' + encodeURIComponent(code) + '&email=' + encodeURIComponent(email);
  return '<div style="max-width:480px;margin:0 auto;padding:0;font-family:Arial,Helvetica,sans-serif;background:#0d0f18;border-radius:12px;overflow:hidden">'
    + '<div style="background:linear-gradient(180deg,#111320 0%,#0d1525 100%);padding:40px 24px 32px;text-align:center;border-bottom:1px solid rgba(201,168,76,.1)">'
    + '<div style="font-size:48px;font-weight:900;color:#d4b850;letter-spacing:16px;margin-bottom:8px">知 时</div>'
    + '<div style="font-size:13px;color:#a09060;letter-spacing:8px">知 天 时 · 见 自 己</div>'
    + '</div>'
    + '<div style="padding:28px 24px;text-align:center">'
    + '<div style="font-size:14px;color:#8a8070;letter-spacing:4px;margin-bottom:24px">邮箱验证码</div>'
    + '<div style="background:rgba(201,168,76,.06);border:2px dashed rgba(201,168,76,.2);border-radius:10px;padding:24px;margin:16px 0">'
    + '<span style="font-size:42px;font-weight:900;color:#e8d070;letter-spacing:12px;font-family:Courier New,monospace">' + code + '</span>'
    + '</div>'
    + '<div style="font-size:11px;color:#8a8070;margin-top:16px;line-height:1.8">验证码 5 分钟内有效，请勿转发给他人</div>'
    + '<a href="' + verifyUrl + '" style="display:inline-block;margin-top:20px;padding:14px 36px;background:linear-gradient(135deg,#8a6d28,#c9a84c,#e8cf70);color:#0d0f18;text-decoration:none;border-radius:25px;font-size:15px;font-weight:700;letter-spacing:3px">一键完成验证</a>'
    + '<div style="font-size:10px;color:#6a6050;margin-top:12px">或手动输入验证码完成注册</div>'
    + '</div>'
    + '<div style="padding:16px 24px;text-align:center;border-top:1px solid rgba(255,255,255,.04);font-size:10px;color:#5a5860;line-height:1.8">'
    + '此邮件由知时（' + SITE_DOMAIN + '）自动发送<br>天地不言，四时行焉 · 知天时，见自己'
    + '</div></div>';
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
    ToAddress: toEmail, Subject:'知时 - 邮箱验证码', HtmlBody: buildHTML(code, toEmail)
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
