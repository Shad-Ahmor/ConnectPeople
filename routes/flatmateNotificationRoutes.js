const express = require('express');
const router = express.Router();


const { 
  getUserNotifications, 
  markAsRead ,
  getUnreadCount
} = require("../controllers/notificationController.js");

const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware.js');


// Parse JSON and URL-encoded payloads
router.use(express.urlencoded({ extended: true }));
router.use(express.json());




// Notificaion Routes

router.get("/", firebaseAuthMiddleware.verifyToken, getUserNotifications);
router.post("/read", firebaseAuthMiddleware.verifyToken, markAsRead);
router.get("/unread-count", firebaseAuthMiddleware.verifyToken, getUnreadCount);
module.exports = router;