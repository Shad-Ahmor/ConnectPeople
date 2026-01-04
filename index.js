const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const app = express();
app.set('trust proxy', 1);
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const port = process.env.PORT || 5000;
const flatmateAuthRoutes = require("./routes/flatmateAuthRoutes.js");
const propertyRoutes = require("./routes/flatmatePropertyRoutes.js");
const imageRoutes = require("./routes/flatmateImageRoutes.js");
const notificationRoutes = require("./routes/flatmateNotificationRoutes.js");
const negotiateRoutes = require("./routes/flatmateNegotiateRoutes.js");
const chatRoutes = require("./routes/chatRoutes.js");

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true, 
  legacyHeaders: false,
});
app.use(globalLimiter);

// 🟢 FIX: CORS setup with explicit allowed headers
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN?.replace(/\/$/, ""),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false, 
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  contentSecurityPolicy: false, 
}));

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const isProduction = process.env.NODE_ENV === "production";

app.use((req, res, next) => {
  res.setCookie = (name, value, options = {}) => {
    // 💡 PRO TIP: Server par agar cookie nahi mil rahi, toh domain attribute check karna padta hai
    const cookieConfig = {
      httpOnly: true,
      secure: true, // Server (HTTPS) par hamesha true hona chahiye login/me sync ke liye
      sameSite: 'none', // Cross-site (Frontend to Backend) ke liye 'none' + secure: true mandatory hai
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
      ...options
    };

    // Local development ke liye secure check relax kar sakte hain agar HTTPS nahi hai
    if (!isProduction && req.hostname === 'localhost') {
        cookieConfig.secure = false;
        cookieConfig.sameSite = 'lax';
    }

    res.cookie(name, value, cookieConfig);
  };
  next();
});

app.use("/flatmate", flatmateAuthRoutes);
app.use("/property", propertyRoutes);
app.use("/images", imageRoutes);
app.use("/notifications", notificationRoutes);
app.use("/negotiate", negotiateRoutes);
app.use("/chat", chatRoutes);

app.get("/health", (req, res) => {
  if (req.headers["x-health-key"] !== process.env.HEALTH_KEY) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});