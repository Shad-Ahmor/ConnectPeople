const path = require('path');
// 💡 FIX 1: Assuming .env file is next to index.js inside the ConnectPeople folder
// Change '..' to '.' if the .env file is in the same folder as index.js.
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 5000;
const flatmateAuthRoutes = require("./routes/flatmateAuthRoutes.js");
const propertyRoutes = require("./routes/flatmatePropertyRoutes.js");
const imageRoutes = require("./routes/flatmateImageRoutes.js");
const notificationRoutes = require("./routes/flatmateNotificationRoutes.js");
const negotiateRoutes = require("./routes/flatmateNegotiateRoutes.js");
const chatRoutes = require("./routes/chatRoutes.js");

// --------------------
// CORS Setup
// --------------------
// Sabhi endpoints ke liye allow karne ke liye origin callback use kar rahe hain
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 15 मिनट में प्रत्येक IP से अधिकतम 1000 अनुरोध (requests)
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true, 
  legacyHeaders: false,
});
app.use(globalLimiter);
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN, 
  credentials: true,
}));

// --------------------
// Middlewares
// --------------------
app.use(helmet());
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// --------------------
// Cookie Middleware for Secure + HttpOnly
// --------------------
// Helper middleware to set default cookie options for all responses
const isProduction = process.env.NODE_ENV === "production";
app.use((req, res, next) => {
  res.setCookie = (name, value, options = {}) => {
    const defaultOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    };
    res.cookie(name, value, { ...defaultOptions, ...options });
  };
  next();
});

// --------------------
// Flatmate Routes
// --------------------
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
// --------------------
// Start Server
// --------------------
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});       
