// utils/imageUtils.js

exports.normalizeImagesInput = (images) => {
  if (!images) return [];
  // Agar single image string aayi hai toh use array mein convert karein
  if (typeof images === "string") return [images];
  if (!Array.isArray(images)) return [];
  return images.filter(Boolean);
};

exports.isValidImagePayload = (img) => {
  if (typeof img !== "string") return false;

  // 1. Check for HTTPS URLs (Cloudinary/S3 links)
  if (img.startsWith("https://")) return true;

  // 2. Check for Base64 Data URI
  // Logic: Starts with data:image/, followed by (jpeg|jpg|png), then ;base64,
  const base64Regex = /^data:image\/(jpeg|jpg|png);base64,/;
  
  if (base64Regex.test(img)) {
    // Basic integrity check: string length should be reasonable for an image
    // Minimal valid base64 image usually exceeds 100 characters
    return img.length > 100;
  }

  return false;
};