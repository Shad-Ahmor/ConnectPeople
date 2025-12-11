// utils/mailer.js
const nodemailer = require("nodemailer");

// 💡 NEW CHECK: Ensure environment variables are loaded
const requiredAuthVars = ['SUPPORT_EMAIL', 'OAUTH_CLIENT_ID', 'OAUTH_CLIENT_SECRET', 'OAUTH_REFRESH_TOKEN'];
requiredAuthVars.forEach(key => {
    if (!process.env[key]) {
        console.error(`❌ FATAL: Mailer cannot start. Environment variable ${key} is NOT loaded from .env.`);
    }
});


const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    type: "OAuth2",
    user: process.env.SUPPORT_EMAIL,         // MUST MATCH MAIL FROM
    clientId: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    refreshToken: process.env.OAUTH_REFRESH_TOKEN,
  },
});


const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"Find Your Flatmate" <${process.env.SUPPORT_EMAIL}>`,
      to,
      subject,
      html,
    });

    console.log("📧 Email Sent:", info.messageId);
    return true;

  } catch (err) {
    // Detailed Nodemailer Error Logging
    console.error("❌ Email Send Error Message:", err.message);
    
    if (err.response) {
        console.error("  -> Nodemailer Error Response:", err.response); 
        console.error("  -> Nodemailer Response Code:", err.responseCode);
        console.error("  -> Nodemailer Command:", err.command);
    } else {
        console.error("  -> Full Error Object (Fallback):", err);
    }
    
    return false;
  }
};

module.exports = sendEmail;