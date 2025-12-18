// functions/utils/mailer.js
const nodemailer = require("nodemailer");
require("dotenv").config();

const GMAIL_EMAIL = process.env.GMAIL_EMAIL;
const GMAIL_PASS = process.env.GMAIL_PASS;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_EMAIL,
    pass: GMAIL_PASS,
  },
});

transporter.verify((err) => {
  if (err) {
    console.error("Mailer transport error:", err.message);
  } else {
    console.log("Mailer ready to send emails");
  }
});

const sendEmail = async ({to, subject = "Your OTP", otp, html}) => {
  const formatOtp = (o) =>
    (o ? o.toString().split("").join(" ") : "— — — —");

  const content = html || `
        <div style="
            font-family: Arial, sans-serif;
            background: #f6f9ff;
            color: #1b2b45;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            max-width: 520px;
            margin: 0 auto;
        ">
            <h2 style="
                margin: 0 0 10px 0;
                font-size: 18px;
                color: #07204a;
            ">
                Welcome to FindYourFlatmates
            </h2>

            <p style="
                margin: 0 0 16px 0;
                color: #3b4b62;
                font-size: 14px;
            ">
                Enter the code below to finish signing in.
            </p>

            <div style="
                display: inline-block;
                padding: 12px 18px;
                background: linear-gradient(90deg,
                #eaf4ff, #f8fcff);
                border-radius: 10px;
                font-weight: 700;
                font-size: 26px;
                letter-spacing: 8px;
                color: #0b63c6;
                margin: 8px 0 12px 0;
            ">
                ${formatOtp(otp)}
            </div>

            <p style="
                margin-top: 8px;
                color: #6b7280;
                font-size: 12px;
            ">
                This code expires in 10 minutes. Ignore if you did not
                request it.
            </p>
        </div>
    `;

  try {
    const info = await transporter.sendMail({
      from: `"FindYourFlatmates" <${GMAIL_EMAIL}>`,
      to,
      subject,
      html: content,
    });

    console.log("Email sent:", info.messageId);
    return true;
  } catch (err) {
    console.error("Email send failed:", err.message);
    return false;
  }
};

module.exports = sendEmail;
