// utils/mailer.js
const nodemailer = require("nodemailer");

const requiredVars = ["SUPPORT_EMAIL", "SMTP_PASS"];

requiredVars.forEach((key) => {
  if (!process.env[key]) {
    console.error(
      `❌ FATAL: Mailer cannot start. Environment variable ${key} is missing.`
    );
  }
});

// ✅ Create Gmail transporter using App Password
const transporter = nodemailer.createTransport({
  service: "gmail",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SUPPORT_EMAIL, // noreply email
    pass: process.env.SMTP_PASS,     // Gmail App Password
  },
});

// ✅ Verify transporter once at startup (optional but recommended)
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Mailer Transport Error:", error.message);
  } else {
    console.log("✅ Mailer is ready to send emails");
  }
});

/**
 * ✅ Send Email Utility
 */
const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"FindYourFlatmates" <${process.env.SUPPORT_EMAIL}>`,
      to,
      subject,
      html,
    });

    console.log("📧 Email Sent Successfully:", info.messageId);
    return true;
  } catch (err) {
    console.error("❌ Email Send Failed:", err.message);

    if (err.response) {
      console.error("  → SMTP Response:", err.response);
      console.error("  → Response Code:", err.responseCode);
      console.error("  → SMTP Command:", err.command);
    }

    return false;
  }
};

module.exports = sendEmail;
