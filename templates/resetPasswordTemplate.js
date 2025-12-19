const resetPasswordTemplate = (otp) => {
  return `
    <div style="padding:40px; font-family:sans-serif; background-color:#f9f9f9; text-align:center;">
      <div style="background-color:#fff; padding:20px; border-radius:12px; display:inline-block; border:1px solid #eee;">
        <h2 style="color:#333;">Password Reset Code</h2>
        <p style="color:#666;">Use the 6-digit code below to reset your password. This code is valid for 10 minutes.</p>
        
        <div style="margin:30px 0; padding:15px; background:#f0f7ff; border:2px dashed #007AFF; border-radius:8px;">
          <span style="font-size:32px; font-weight:bold; letter-spacing:8px; color:#007AFF;">${otp}</span>
        </div>

        <p style="font-size:12px; color:#999; margin-top:20px;">
          If you didn't request this, please ignore this email or secure your account.
        </p>
      </div>
    </div>
  `;
};
module.exports = { resetPasswordTemplate };