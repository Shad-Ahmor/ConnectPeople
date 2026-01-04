const { db } = require('../config/firebaseConfig.js');
const admin = require('firebase-admin');

exports.submitOrUpdateOffer = async (negotiationData) => {
    const { listingId, visitorId, ownerId, offerAmount, originalRent, visitorName, visitorPhoto } = negotiationData;

    const timestamp = admin.database.ServerValue.TIMESTAMP;
    
    const offerPayload = {
        listingId,
        visitorId,
        ownerId,
        offerAmount: parseFloat(offerAmount),
        originalRent: parseFloat(originalRent),
        status: 'pending',
        visitorName,
        visitorPhoto,
        updatedAt: timestamp
    };

    const updates = {};

    // 1. Owner's Property Node: /flatmate/users/{ownerId}/property/{listingId}/negotiations/{visitorId}
    updates[`/flatmate/users/${ownerId}/property/${listingId}/negotiations/${visitorId}`] = offerPayload;

    // 2. Visitor's Profile Node (Optional but recommended): /flatmate/users/${visitorId}/myOffers/{listingId}
    updates[`/flatmate/users/${visitorId}/myOffers/${listingId}`] = offerPayload;

    await db.ref().update(updates);
    return offerPayload;
};

exports.getOfferStatusFromDB = async (ownerId, listingId, visitorId) => {
    // Aapke structure ke mutabik path
    const path = `/flatmate/users/${ownerId}/property/${listingId}/negotiations/${visitorId}`;
    const snapshot = await db.ref(path).once('value');
    return snapshot.exists() ? snapshot.val() : null;
};