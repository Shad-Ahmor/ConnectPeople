const crypto = require("crypto");

exports.hashEmail = (email) =>
  crypto.createHash("sha256").update(email.toLowerCase()).digest("hex");

exports.hashIp = (ip) =>
  crypto.createHash("sha256").update(ip).digest("hex");
