const express = require("express");
const router = express.Router();
const { uploadSingleImage } = require("../controllers/imageController");
const firebaseAuthMiddleware = require("../middleware/firebaseAuthMiddleware");
const { handleImagesUpload } = require("../middleware/imageUploadMiddleware");

const rateLimit = require("express-rate-limit");

const imageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many image uploads. Try later."
});

router.post(
  "/upload",
  imageLimiter,
  firebaseAuthMiddleware.verifyToken,
  handleImagesUpload("properties"), // Middleware handles bulk/single and attaches to req.uploadedImages
  (req, res, next) => {
    // 🔥 If middleware already uploaded images, return them directly
    if (req.uploadedImages && req.uploadedImages.length > 0) {
      return res.status(201).json({
        message: "Images uploaded successfully",
        images: req.uploadedImages,
      });
    }
    // Otherwise, proceed to single upload controller
    next();
  },
  uploadSingleImage
);

module.exports = router;