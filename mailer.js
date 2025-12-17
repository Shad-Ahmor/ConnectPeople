const { google } = require('googleapis');

const sendEmail = async ({ to, subject, html }) => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      "https://developers.google.com/oauthplayground"
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // 1. Email structure banana (MIME format)
    // Dhyan de: From me wahi email ayegi jo SUPPORT_EMAIL hai
    const str = [
      `To: ${to}`,
      `From: "FindYourFlatmates Support" <${process.env.SUPPORT_EMAIL}>`,
      `Subject: ${subject}`,
      'Content-type: text/html;charset=utf-8',
      'MIME-Version: 1.0',
      '',
      html,
    ].join('\n');

    // 2. Base64 Encode karna (Gmail API ki requirement hai)
    const encodedMail = Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // 3. API Call se mail bhejna
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMail,
      },
    });

    console.log("🚀 Success! Email sent via Gmail REST API:", res.data.id);
    return true;

  } catch (error) {
    console.error("❌ Gmail API Error:", error.response ? error.response.data : error.message);
    return false;
  }
};

module.exports = sendEmail;