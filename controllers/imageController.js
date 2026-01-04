const { uploadImage } = require("../services/cloudinaryService");

exports.uploadSingleImage = async (req, res) => {
  try {
    const { image, folder } = req.body; // Folder dynamic ho sakta hai

    if (!image) {
      return res.status(400).json({ message: "Image is required" });
    }

    // 🔥 MODIFICATION: Passing explicit compression options for single upload
    const compressionOptions = {
      transformation: [
        { width: 1000, crop: "limit" }, // Resize
        { quality: "auto:low" },         // Strict compression < 100KB
        { fetch_format: "auto" }        // WebP/AVIF Format
      ]
    };

    // Service call with the new options parameter
    const uploaded = await uploadImage(image, folder || "properties", compressionOptions);

    return res.status(201).json({
      message: "Image uploaded successfully",
      image: uploaded,
    });

  } catch (error) {
    console.error("Single image upload error:", error);
    return res.status(500).json({
      message: "Image upload failed",
    });
  }
};