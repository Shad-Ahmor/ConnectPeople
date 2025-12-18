// middleware/firewall.js
const admin = require("firebase-admin");

/**
 * Strict Firewall: Monthly, IP, and Email Limiting.
 * Limits: Email 5/day, IP 8/day, Monthly 100k.
 * Max 70 chars per line. Python-style indentation.
 */

const MONTHLY_LIMIT = 100000;
const IP_LIMIT = 8;// Max total from one IP per day
const EMAIL_LIMIT = 5;// Max per specific email per day
const WINDOW = 86400000; // 24 Hours in milliseconds

const WHITELIST = [
  "127.0.0.1",
  "::1",
  "gdlsofts@gmail.com",
];

const firewall = async (req, res, next) => {
  const {email, clientIp} = req.body;
  const rawIp = clientIp || req.ip || "0.0.0.0";
  const cleanIp = rawIp.split(",")[0].trim();
  const ipKey = cleanIp.replace(/\./g, "_");

  const monthKey = new Date().toISOString()
      .slice(0, 7).replace("-", "_");

  if (WHITELIST.includes(cleanIp) || WHITELIST.includes(email)) {
    return next();
  }

  const emailKey = Buffer.from(email || "anon")
      .toString("base64")
      .replace(/=/g, "");

  const db = admin.database();
  const now = Date.now();

  try {
    const [uSnap, iSnap, emSnap] = await Promise.all([
      db.ref(`usage_stats/${monthKey}`).get(),
      db.ref(`rate_limit/ip/${ipKey}`).get(),
      db.ref(`rate_limit/email/${emailKey}`).get(),
    ]);

    // 1. Monthly Kill-Switch (80% Protection)
    const totalUsed = uSnap.val() || 0;
    if (totalUsed >= MONTHLY_LIMIT) {
      return res.status(503).json({
        error: "Quota Exceeded",
        message: "Monthly mail limit exceed. Try next month.",
      });
    }

    const ipData = iSnap.val() || {count: 0, last: now};
    const emData = emSnap.val() || {count: 0, last: now};

    // Reset logic for 24-hour window
    if (now - ipData.last > WINDOW) ipData.count = 0;
    if (now - emData.last > WINDOW) emData.count = 0;

    // 2. Email Daily Limit (Max 5)
    if (emData.count >= EMAIL_LIMIT) {
      return res.status(429).json({
        message: "Email daily limit reached (5/day). Try tomorrow.",
      });
    }

    // 3. IP Daily Limit (Max 8)
    if (ipData.count >= IP_LIMIT) {
      return res.status(429).json({
        message: "IP daily limit reached (8/day). Try tomorrow.",
      });
    }

    // 4. All checks passed: Update DB
    await Promise.all([
      db.ref(`usage_stats/${monthKey}`).set(totalUsed + 1),
      db.ref(`rate_limit/ip/${ipKey}`).set({
        count: ipData.count + 1,
        last: (ipData.count === 0) ? now : ipData.last,
      }),
      db.ref(`rate_limit/email/${emailKey}`).set({
        count: emData.count + 1,
        last: (emData.count === 0) ? now : emData.last,
      }),
    ]);

    return next();
  } catch (err) {
    console.error("Firewall Error:", err);
    return res.status(500).send("Security Check Failed");
  }
};

module.exports = firewall;
