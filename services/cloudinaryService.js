const cloudinary = require("cloudinary").v2;

// Cloudinary config (env based)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload image to Cloudinary
 * @param {String} file - base64 / temp file path
 * @param {String} folder - cloudinary folder name
 * @param {Object} options - extra cloudinary options (like transformations)
 */
// 🔥 Added 'options' parameter to support middleware settings
exports.uploadImage = async (base64Data, folder = "properties", options = {}) => {
  try {
    // Agar options mein transformation nahi hai, toh default tight compression use hoga
    const finalOptions = {
      folder: folder,
      transformation: options.transformation || [
        { width: 1000, crop: "limit" }, // Image agar bahut badi hai toh resize kar dega
        { quality: "auto:low" },         // Tightest compression (Quality low karega par visual loss kam hoga)
        { fetch_format: "auto" }        // Browser ke hisaab se best format (webp/avif) mein badal dega
      ],
      ...options // Baaki extra options (flags, etc.) merge ho jayenge
    };

    const result = await cloudinary.uploader.upload(base64Data, finalOptions);

    return {
      url: result.secure_url,
      public_id: result.public_id,
      size: result.bytes // Aap yahan check kar sakte ho kitne bytes ki bani
    };
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    throw error;
  }
};


/**
 * Delete image from Cloudinary
 */
exports.deleteImage = async (publicId) => {
  if (!publicId) return;

  await cloudinary.uploader.destroy(publicId);
};