const axios = require("axios");

const sendEmail = async ({ to, subject, html , otp }) => {
  try {
    const data = {
      sender: { 
        name: "FYF Support", 
        email: process.env.SUPPORT_EMAIL // Brevo verified sender email
      },
      replyTo: { email: process.env.SUPPORT_EMAIL },
      to: [{ email: to }],
      subject: subject,
      htmlContent: html,
      textContent: `Your FYF verification code is: ${otp}. This code is valid for 10 minutes.`
    };

    const config = {
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    };

    const response = await axios.post("https://api.brevo.com/v3/smtp/email", data, config);

    return response.status === 201 || response.status === 200;

  } catch (error) {
    console.error("❌ Brevo API Error:", error.response ? error.response.data : error.message);
    return false;
  }
};

module.exports = sendEmail;