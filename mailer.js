const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // ✅ 587 के लिए हमेशा false रखें
  auth: {
    user: process.env.SUPPORT_EMAIL,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    // ✅ यह Render पर 'Connection Refused' एरर से बचाने में मदद करता है
    rejectUnauthorized: false,
    minVersion: "TLSv1.2"
  },
  connectionTimeout: 20000, 
  greetingTimeout: 15000,
});

// वेरिफिकेशन चेक
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ 587 Port also failed:", error.message);
  } else {
    console.log("✅ Connection Success on Port 587!");
  }
});

const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"FindYourFlatmates" <${process.env.SUPPORT_EMAIL}>`,
      to,
      subject,
      html,
    });
    console.log("📧 Sent Successfully:", info.messageId);
    return true;
  } catch (err) {
    console.error("❌ Send Failed on 587:", err.message);
    return false;
  }
};

module.exports = sendEmail;