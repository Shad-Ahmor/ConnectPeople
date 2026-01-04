const negotiationService = require('../services/flatmatenegotiationService.js');

exports.submitNegotiationOffer = async (req, res) => {
    try {
        const { listingId } = req.params;
        const { offerAmount, currentRent, ownerId } = req.body;
        const visitorId = req.userId; // Middleware se UID

        if (!ownerId) return res.status(400).json({ success: false, message: "Owner ID is required" });

        const negotiationData = {
            listingId,
            visitorId,
            ownerId,
            offerAmount,
            originalRent: currentRent,
            visitorName: req.user?.name || "Guest",
            visitorPhoto: req.user?.picture || ""
        };

        const result = await negotiationService.submitOrUpdateOffer(negotiationData);
        
        res.status(200).json({ 
            success: true, 
            message: "Offer submitted successfully!", 
            existingOffer: result 
        });
    } catch (error) {
        console.error("Nego Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

exports.getNegotiationStatus = async (req, res) => {
    try {
        const { listingId } = req.params;
        const { ownerId } = req.query; // Query params se ownerId lein
        const visitorId = req.userId;

        if (!ownerId) return res.status(400).json({ success: false, message: "Owner ID missing in query" });

        const existingOffer = await negotiationService.getOfferStatusFromDB(ownerId, listingId, visitorId);
        res.status(200).json({ success: true, existingOffer });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};