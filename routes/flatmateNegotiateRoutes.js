const express = require('express');
const router = express.Router();
const negotiationController = require('../controllers/flatmatenegotiationController');
const { verifyToken } = require('../middleware/firebaseAuthMiddleware');

// POST: /property/:listingId/negotiate
router.post('/:listingId/negotiate', verifyToken, negotiationController.submitNegotiationOffer);

// GET: /property/:listingId/negotiate/status?ownerId=XYZ
router.get('/:listingId/negotiate/status', verifyToken, negotiationController.getNegotiationStatus);

module.exports = router;