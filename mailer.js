const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, html }) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 465, // Port jo aapko wahan dikha
      secure: true,
      auth: {
        user: process.env.BREVO_USER, // Aapka email
        pass: process.env.BREVO_PASS, // Jo password aapko mila hai
      },
      connectionTimeout: 10000, 
      greetingTimeout: 10000,
    });

    const mailOptions = {
      from: `"FindYourFlatMates" <${process.env.SUPPORT_EMAIL}>`,
      to: to,
      subject: subject,
      html: html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Mail Sent! Message ID:", info.messageId);
    return true;
  } catch (error) {
    console.error("❌ SMTP Error:", error.message);
    return false;
  }
};

module.exports = sendEmail;