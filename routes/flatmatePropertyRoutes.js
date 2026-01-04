const express = require('express');
const router = express.Router();

const { 
    flatmateListing,
    fetchAllListings,     
    fetchSingleListing,   
    fetchUserListings,    
    updateListing,        
    deleteListing        ,
    getReviews,
    removeReview,
    addReview,
    getDashboardData,
    
} = require("../controllers/flatmatePropertyController.js");





const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware.js');


// Parse JSON and URL-encoded payloads
router.use(express.urlencoded({ extended: true }));
router.use(express.json());
router.post("/all", fetchAllListings);
router.get('/single/:listingId',   fetchSingleListing); // Get details
router.get('/review/:listingId/', firebaseAuthMiddleware.verifyToken, getReviews);
router.post("/create", firebaseAuthMiddleware.verifyToken, flatmateListing);

router.get("/my-listings", firebaseAuthMiddleware.verifyToken, fetchUserListings);

// यह विशिष्ट राउट है, इसे डायनामिक राउट से पहले होना चाहिए।
router.get("/my-dashboard", firebaseAuthMiddleware.verifyToken, getDashboardData);

// नई लिस्टिंग पोस्ट करें

// ------------------------------------
// 🏠 Public Listing Routes (Read-only)
// ------------------------------------
// सभी लिस्टिंग्स को फेच करें (होमस्क्रीन के लिए)
// यह डायनामिक राउट अब my-listings के बाद आता है।

// ----------------------------------------------------
// 🔐 Remaining Protected Routes
// ----------------------------------------------------
// लिस्टिंग को अपडेट करें
router.put("/update/:listingId", firebaseAuthMiddleware.verifyToken, updateListing);
// लिस्टिंग को डिलीट करें
router.delete("/delete/:listingId", firebaseAuthMiddleware.verifyToken, deleteListing);
// ------------------------
// Protected User Auth Routes
// ------------------------


 // Review Routes
router.post('/review/:listingId',  firebaseAuthMiddleware.verifyToken, addReview);
router.delete('/review/:listingId', firebaseAuthMiddleware.verifyToken, removeReview);

// Negotiation Routes can be added here similarly


module.exports = router;