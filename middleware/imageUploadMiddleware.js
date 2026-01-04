const { uploadImage, deleteImage } = require("../services/cloudinaryService");
const {
  normalizeImagesInput,
  isValidImagePayload,
} = require("../utils/imageUtils");

const handleImagesUpload = (folder = "default") => {
  return async (req, res, next) => {
    // 🔥 Track uploaded images for cleanup in case of error
    let uploadedImages = [];

    try {
      // Frontend se 'image' ya 'images' dono handle karne ke liye fallback
      const rawInput = req.body.images || req.body.image;
      const images = normalizeImagesInput(rawInput);

      if (images.length > 5) {
        return res.status(400).json({
          message: "Maximum 5 images allowed",
        });
      }

      for (const img of images) {
        if (!isValidImagePayload(img)) {
          return res.status(400).json({
            message: "Invalid image format (Only JPG, JPEG, PNG allowed)",
          });
        }
      }

      if (images.length > 0) {
        // 🔥 MODIFICATION: Tight compression parameters for <100KB target
        const compressionOptions = {
          folder: folder,
          transformation: [
            { width: 1000, crop: "limit" }, // Large images ko resize karega
            { quality: "auto:low" },         // Sabse tight compression
            { fetch_format: "auto" },       // WebP/AVIF format automatically
            { flags: "lossy" }              // Size kam karne ke liye lossy flag
          ]
        };

        // Upload and store results for controller or cleanup
        uploadedImages = await Promise.all(
          images.map((img) => uploadImage(img, folder, compressionOptions))
        );
      }

      // 🔥 attach to request (controller will use)
      req.uploadedImages = uploadedImages;

      next();
    } catch (error) {
      // 🔥 CLEANUP: Error aane par Cloudinary se uploaded images delete karna
      // Yahan error.uploadedImages ke bajaye local variable use hoga
      const imagesToCleanup = uploadedImages.length ? uploadedImages : (error?.uploadedImages || []);
      
      if (imagesToCleanup.length) {
        for (const img of imagesToCleanup) {
          if (img.public_id) {
            await deleteImage(img.public_id).catch(err => console.error("Cleanup failed for:", img.public_id));
          }
        }
      }

      console.error("Image middleware error:", error);
      return res.status(500).json({
        message: "Image upload failed or timed out",
      });
    }
  };
};

module.exports = { handleImagesUpload };