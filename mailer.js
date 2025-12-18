const axios = require("axios");

const sendEmail = async ({ to, subject, html }) => {
  try {
    const data = {
      sender: { 
        name: "FindYourFlatMates", 
        email: process.env.SUPPORT_EMAIL // Brevo verified sender email
      },
      to: [{ email: to }],
      subject: subject,
      htmlContent: html,
    };

    const config = {
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    };

    const response = await axios.post("https://api.brevo.com/v3/smtp/email", data, config);

    if (response.status === 201 || response.status === 200) {
      console.log("✅ Brevo API: Mail Sent Successfully!", response.data.messageId);
      return true;
    }
    return false;

  } catch (error) {
    console.error("❌ Brevo API Error:", error.response ? error.response.data : error.message);
    return false;
  }
};

module.exports = sendEmail;