const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware.js');

router.post('/send', firebaseAuthMiddleware.verifyToken, chatController.sendMessage);
router.post('/send-bulk', firebaseAuthMiddleware.verifyToken, chatController.sendBulkMessages);
router.get('/messages/:chatId', firebaseAuthMiddleware.verifyToken, chatController.getChatMessages);

router.get('/list', firebaseAuthMiddleware.verifyToken, chatController.getUserChats);
router.get('/status/:propertyId', firebaseAuthMiddleware.verifyToken, chatController.getChatStatus);

module.exports = router;