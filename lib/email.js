/**
 * 邮件发送模块 — 阿里云 DirectMail
 * v1.0
 */
const DM = require('@alicloud/dm20151123');
const $dm = new DM.default({
  accessKeyId: process.env.ALI_AK_ID || '',
  accessKeySecret: process.env.ALI_AK_SECRET || '',
  regionId: 'cn-hangzhou'
});

const FROM_ADDR = process.env.MAIL_FROM || 'noreply@mail.knowbazi.online';

function buildHTML(code) {
  return '<div style="max-width:480px;margin:0 auto;padding:32px 24px;font-family:Arial,Helvetica,sans-serif;background:#f9f9f5;border-radius:12px">'
    + '<div style="text-align:center;font-size:28px;font-weight:900;color:#8a7030;letter-spacing:6px;margin-bottom:16px">知 时</div>'
    + '<div style="text-align:center;font-size:14px;color:#6a6050;margin-bottom:24px">邮箱验证码</div>'
    + '<div style="text-align:center;background:#fff;border:2px dashed #d8c060;border-radius:10px;padding:20px;margin:16px 0">'
    + '<span style="font-size:36px;font-weight:900;color:#8a7030;letter-spacing:8px;font-family:monospace">' + code + '</span>'
    + '</div>'
    + '<div style="text-align:center;font-size:12px;color:#a0a090;margin-top:16px">验证码 5 分钟内有效，请勿转发给他人</div>'
    + '<div style="text-align:center;font-size:10px;color:#c0c0b0;margin-top:24px;padding-top:16px;border-top:1px solid #e8e8e0">此邮件由知时（knowbazi.online）自动发送，无需回复</div>'
    + '</div>';
}

async function sendCode(toEmail, code) {
  return $dm.singleSendMail(new DM.SingleSendMailRequest({
    accountName: FROM_ADDR,
    addressType: 1,
    replyToAddress: false,
    toAddress: toEmail,
    subject: '知时 - 邮箱验证码',
    htmlBody: buildHTML(code)
  }));
}

module.exports = { sendCode };
