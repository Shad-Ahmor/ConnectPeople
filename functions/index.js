const functions = require("firebase-functions");
const admin = require("firebase-admin");
const sendEmail = require("./utils/mailer");
const firewall = require("./middleware/firewall");

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.sendOtp = functions.https.onRequest(async (req, res) => {
  return firewall(req, res, async () => {
    try {
      const {email, type, msg} = req.body;

      if (!email || !type || !msg) {
        return res.status(400).json({
          message: "Email, Type and MSG are required.",
        });
      }

      let subject = "";
      let html = "";
      const reqId = Math.random().toString(36).toUpperCase().slice(2, 10);

      if (type === "OTP") {
        subject = `[${reqId}] Verification Code for FindYourFlatmates`;
        html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    .wrap { background:#f9fafb; padding:30px; font-family:sans-serif; }
    .card { max-width:480px; margin:0 auto; background:#fff; 
            border-radius:16px; border:1px solid #eee; overflow:hidden; }
    .top { background:linear-gradient(135deg,#6366f1,#a855f7); 
           padding:20px; text-align:center; color:#fff; }
    .mid { padding:32px; text-align:center; }
    .code { font-size:36px; font-weight:800; letter-spacing:6px; 
            color:#111827; background:#f3f4f6; padding:15px; 
            border-radius:12px; margin:20px 0; border:1px solid #e5e7eb; }
    .info { font-size:14px; color:#6b7280; line-height:1.6; }
    .sec { border-top:1px solid #f3f4f6; padding:20px; 
           font-size:12px; color:#9ca3af; text-align:center; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="top">
        <div style="font-weight:bold; font-size:20px;">FYF</div>
        <div style="font-size:14px; opacity:0.9;">Secure Access</div>
      </div>
      <div class="mid">
        <p style="font-weight:600;">Verification Code</p>
        <div class="code">${msg}</div>
        <p class="info">This code is valid for 60 seconds.</p>
        <p class="info" style="font-size:12px;">Request ID: ${reqId}</p>
      </div>
      <div class="sec">
        <strong>Security Warning:</strong> Never share this code. 
        If you didn't request this, please secure your account.
      </div>
    </div>
  </div>
</body>
</html>`;
      } else if (type === "Message") {
        subject = "Update from FindYourFlatmates";
        html = `<div style="padding:20px; color:#333;">${msg}</div>`;
      } else {
        return res.status(400).json({
          message: "Invalid type. Use OTP or Message",
        });
      }

      const success = await sendEmail({to: email, subject, html});

      if (success) {
        return res.status(200).json({
          message: "Email sent successfully!",
          requestId: reqId,
        });
      }

      return res.status(500).json({message: "Failed to send email."});
    } catch (error) {
      console.error("❌ sendMailHandler error:", error);
      return res.status(500).json({message: "Internal server error"});
    }
  });
});
