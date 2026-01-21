const { db } = require("./firebaseConfig");
/**
 * Enhanced Firewall for Brevo Protection
 * Email Limit: 3/day | IP Limit: 8/day
 * Purpose: Anti-DDOS, Anti-Brute Force, Quota Saving
 */

const MONTHLY_LIMIT = 9000; // Brevo free (300*30)
const IP_LIMIT = 8;
const EMAIL_LIMIT = 4; 
const WINDOW = 86400000; // 24 Hours

const WHITELIST = ["127.0.0.1", "::1", "gdlsofts@gmail.com"];

const firewall = async (req, res, next) => {
    // 1. Get Real IP (Handles Render/Cloudflare proxies)
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] 
                     || req.socket.remoteAddress 
                     || "0.0.0.0";
    
    const { email } = req.body;
    const ipKey = clientIp.replace(/\./g, "_").replace(/:/g, "_");
    const monthKey = new Date().toISOString().slice(0, 7).replace("-", "_");

    // Whitelist Bypass
    if (WHITELIST.includes(clientIp) || WHITELIST.includes(email)) {
        return next();
    }

    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }

    const emailKey = Buffer.from(email).toString("base64").replace(/=/g, "");
    const db = admin.database();
    const now = Date.now();

    try {
        const [uSnap, iSnap, emSnap] = await Promise.all([
            db.ref(`usage_stats/${monthKey}`).get(),
            db.ref(`rate_limit/ip/${ipKey}`).get(),
            db.ref(`rate_limit/email/${emailKey}`).get(),
        ]);
        // Rule 1: Monthly Global Kill-Switch
        const totalUsed = uSnap.val() || 0;
        if (totalUsed >= MONTHLY_LIMIT) {
            return res.status(503).json({
                message: "Service temporarily unavailable. Quota full."
            });
        }

        const ipData = iSnap.val() || { count: 0, last: now };
        const emData = emSnap.val() || { count: 0, last: now };

        // Reset counters if 24 hours passed
        if (now - ipData.last > WINDOW) ipData.count = 0;
        if (now - emData.last > WINDOW) emData.count = 0;

        // Rule 2: Email Strict Limit (Max 3)
        if (emData.count >= EMAIL_LIMIT) {
            return res.status(429).json({
                message: "Too many requests for this email. Limit 3/day."
            });
        }

        // Rule 3: IP Strict Limit (Max 8)
        if (ipData.count >= IP_LIMIT) {
            return res.status(429).json({
                message: "Device limit reached. Try again after 24 hours."
            });
        }

        // Success: Update Firebase with transaction-like logic
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

        next();
    } catch (err) {
        console.error("Firewall Critical Error:", err);
        return res.status(500).send("Security verification failed");
    }
};

module.exports = firewall;