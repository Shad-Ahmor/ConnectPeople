const resetPasswordTemplate = (resetLink) => {
  return `
    <div style="padding:20px; font-family:sans-serif;">
      <h2>Password Reset Request</h2>
      <p>We received a request to reset your password.</p>
      <p>Click the button below to continue:</p>

      <a href="${resetLink}"
         style="display:inline-block; padding:12px 22px; 
                background:#007AFF; color:#fff; 
                text-decoration:none; border-radius:6px;">
        Reset Password
      </a>

      <p style="margin-top:20px;">If this wasn’t you, please ignore this email.</p>
    </div>
  `;
};
module.exports = resetPasswordTemplate;
