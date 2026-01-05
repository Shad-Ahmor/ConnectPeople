/**
 * 💡 FLATMATTE PROPERTY CONTROLLER
 * This controller handles all requests related to property listings,
 * including CRUD operations, filtering, reviews, and dashboard analytics.
 * Fully synced with FlatmatePropertyModel and FlatmateListingService.
 */

const flatmateListingService = require('../services/flatmatePropertyService');

// -----------------------------------------------------------------
// 1. CORE LISTING OPERATIONS (CREATE)
// -----------------------------------------------------------------

/**
 * POST: Create a new listing
 * Logic: Validates user, passes data to service, returns formatted result.
 */
exports.flatmateListing = async (req, res) => {
    const userId = req.userId; // Extracted from middleware
    const listingDetails = req.body;

    // Security Guard: Check Authentication
    if (!userId) {
        console.error("[Controller Error] Unauthorized access attempt: No UserID found.");
        return res.status(401).json({
            success: false,
            message: "Authentication error. User ID missing after middleware.",
            field: "auth_required"
        });
    }

    // Input Sanitization (Basic)
    if (!listingDetails || Object.keys(listingDetails).length === 0) {
        return res.status(400).json({
            success: false,
            message: "Bad Request: No listing data provided."
        });
    }

    try {
        console.log(`[Controller] Initiating listing creation for User: ${userId}`);
        
        // Calling Service which utilizes FlatmatePropertyModel internally
        const { listingId, data } = await flatmateListingService.createNewListing(userId, listingDetails);

        // Success Response
        return res.status(201).json({
            success: true,
            message: "Listing submitted successfully and is pending review.",
            listingId,
            data
        });

    } catch (error) {
        // Handle specific validation errors from Model/Service
        const isValidationError = 
            error.message.includes("is required") || 
            error.message.includes("valid positive number") || 
            error.message.includes("image links");

        if (isValidationError) {
            console.warn(`[Validation Warn] ${error.message}`);
            return res.status(400).json({ 
                success: false,
                message: error.message 
            });
        }

        console.error(`[Fatal Controller Error] Listing Creation Failed:`, error);
        return res.status(500).json({
            success: false,
            message: "Failed to submit listing due to a server error.",
            error: error.message
        });
    }
};

// -----------------------------------------------------------------
// 2. FETCH OPERATIONS (READ)
// -----------------------------------------------------------------

/**
 * POST: Fetch all listings with advanced filters
 * Note: Uses req.body because complex filter objects are easier to handle via POST.
 */
exports.fetchAllListings = async (req, res) => {
    try {
        console.log("[Controller] Fetching all listings with filters:", JSON.stringify(req.body));

        // Mapping Frontend body fields to Service filter object
        // Ensuring no logic is lost from your previous filter implementation
        const filters = {
            type: req.body.type || req.body.listingType,
            propertyType: req.body.propertyType || req.body.houseType,
            city: req.body.city,
            bhkType: req.body.bhkType || [], // Expected as Array
            maxRent: req.body.maxRent,
            maxDeposit: req.body.maxDeposit,
            maxMaintenance: req.body.maxMaintenance,
            furnishing: req.body.furnishing,
            parking: req.body.parking,
            facing: req.body.facing,
            floorPref: req.body.floorPref,
            searchText: req.body.searchText || req.body.searchQuery,
            sortBy: req.body.sortBy,
            // Geospatial placeholders
            location: req.body.location,
            radiusKm: req.body.radiusKm
        };

        // Delegate filtering logic to Service (Service traverses all user properties)
        const listings = await flatmateListingService.getAllListingsForFrontend(filters); 

        return res.status(200).json({ 
            success: true,
            count: listings.length,
            listings 
        }); 

    } catch (error) {
        console.error("[Controller Error] Global Fetch failed:", error);
        return res.status(500).json({ 
            success: false,
            message: "Failed to fetch listings.", 
            error: error.message 
        });
    }
};
exports.fetchSingleListing = async (req, res) => {
    const { listingId } = req.params;

    
    // Input validation
    if (!listingId) {
        return res.status(400).json({ 
            success: false,
            message: "Bad Request: Listing ID is required in the URL." 
        });
    }
    const appName = req.query.appName || req.headers['x-app-name'] || 'flatmate';

    try {
        // Service calls your exact traversal logic
        const listing = await flatmateListingService.getSingleListing(listingId,appName);
        
        if (!listing) {
            // 404: Listing not found
            console.warn(`[Controller Warn] Listing ID ${listingId} not found.`);
            return res.status(404).json({ 
                success: false,
                message: "Listing not found. Please verify the provided ID." 
            });
        }
        
        // 200 OK: Listing successfully retrieved with owner details and arrays
        return res.status(200).json({
            success: true,
            data: listing
        });

    } catch (error) {
        // 500: Internal Error
        console.error(`[Controller Error] Failed to fetch listing ${listingId}:`, error.message);
        
        return res.status(500).json({ 
            success: false,
            message: "Internal Server Error: Failed to retrieve listing details.", 
            errorDetail: error.message 
        });
    }
};
/**
 * GET: User's Dashboard/Personal Listings
 * Requires Auth Middleware
 */
exports.fetchUserListings = async (req, res) => {
    const userId = req.userId; // Middleware se mila

    if (!userId) {
        return res.status(401).json({ success: false, message: "User not authenticated." });
    }

    try {
        // Service se formatted data mangwayein
        const { userListings, recentLeads } = await flatmateListingService.getUserListings(userId); 
        
        return res.status(200).json({
            success: true,
            // 🚀 Frontend compatibility:
            // Client side function return { userListings, recentLeads } karta tha
            // Isliye hum yahan keys ko match kar rahe hain
            userListings: userListings, 
            recentLeads: recentLeads,
            count: userListings.length
        });
    } catch (error) {
        console.error(`[Controller Error] dashboard Fetch for ${userId}:`, error);
        return res.status(500).json({ 
            success: false,
            message: "Failed to fetch dashboard data.", 
            error: error.message 
        });
    }
};

// -----------------------------------------------------------------
// 3. MODIFY OPERATIONS (UPDATE/DELETE)
// -----------------------------------------------------------------

/**
 * PATCH: Update specific fields of a listing
 */
exports.updateListing = async (req, res) => {
    const userId = req.userId;
    const { listingId } = req.params; 
    const updates = req.body;

    if (!userId || !listingId) {
        return res.status(401).json({ 
            success: false, 
            message: "Authorization or Listing ID missing." 
        });
    }

    try {
        const updatedData = await flatmateListingService.updateUserListing(userId, listingId, updates);
        
        if (!updatedData) {
            return res.status(404).json({ 
                success: false,
                message: "Listing not found or you do not have permission to modify it." 
            });
        }

        return res.status(200).json({
            success: true,
            message: "Listing updated successfully.",
            listingId,
            data: updatedData
        });

    } catch (error) {
        console.error(`[Controller Error] Update failed for ${listingId}:`, error);
        return res.status(500).json({
            success: false,
            message: "Failed to update listing due to a server error.",
            error: error.message
        });
    }
};

/**
 * DELETE: Remove a listing permanently
 */
exports.deleteListing = async (req, res) => {
    const userId = req.userId;
    const { listingId } = req.params;

    if (!userId) {
        return res.status(401).json({ success: false, message: "User not authenticated." });
    }

    try {
        const success = await flatmateListingService.deleteUserListing(userId, listingId);
        
        if (!success) {
            return res.status(404).json({ 
                success: false,
                message: "Listing not found or deletion permission denied." 
            });
        }

        return res.status(200).json({
            success: true,
            message: "Listing deleted successfully.",
            listingId
        });

    } catch (error) {
        console.error(`[Controller Error] Deletion failed for ${listingId}:`, error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete listing due to a server error.",
            error: error.message
        });
    }
};

// -----------------------------------------------------------------
// 4. REVIEW & RATING OPERATIONS
// -----------------------------------------------------------------

/**
 * POST: Add or Update a User Review
 */
exports.addReview = async (req, res) => {
    const userId = req.userId;
    const { listingId } = req.params;
    const { rating, comment, userName, userImage } = req.body;

    if (!userId) {
        return res.status(401).json({ success: false, message: "User not authenticated." });
    }

    // Strict Rating Validation
    if (!rating || isNaN(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ 
            success: false,
            message: "Invalid Input: Rating must be a number between 1 and 5." 
        });
    }

    try {
        const reviewPayload = {
            rating: Number(rating),
            comment: comment || "",
            userName: userName || "Verified User",
            userImage: userImage || ""
        };

        const result = await flatmateListingService.addOrUpdateReview(listingId, userId, reviewPayload);

        return res.status(200).json({
            success: true,
            message: "Review processed successfully.",
            data: result
        });

    } catch (error) {
        console.error(`[Review Error] Listing ${listingId}:`, error.message);
        if (error.message === "Property not found.") {
            return res.status(404).json({ success: false, message: error.message });
        }
        return res.status(500).json({ 
            success: false, 
            message: "Failed to submit review.", 
            error: error.message 
        });
    }
};

/**
 * DELETE: Remove a specific review
 */
exports.removeReview = async (req, res) => {
    const userId = req.userId;
    const { listingId } = req.params;

    if (!userId) {
        return res.status(401).json({ success: false, message: "User not authenticated." });
    }

    try {
        await flatmateListingService.deleteReview(listingId, userId);
        
        return res.status(200).json({
            success: true,
            message: "Review removed and stats updated successfully."
        });

    } catch (error) {
        console.error(`[Review Delete Error] Listing ${listingId}:`, error);
        if (error.message.includes("not found")) {
            return res.status(404).json({ success: false, message: error.message });
        }
        return res.status(500).json({ success: false, message: "Failed to delete review." });
    }
};

/**
 * GET: Fetch all reviews for a property
 */
exports.getReviews = async (req, res) => {
    const { listingId } = req.params;

    try {
        const result = await flatmateListingService.getPropertyReviews(listingId);
        
        if (!result) {
            return res.status(404).json({ success: false, message: "Property not found." });
        }

        // Convert Review Object to Array and Sort by Timestamp (Latest first)
        const reviewsArray = Object.values(result.reviews).sort((a, b) => b.timestamp - a.timestamp);

        return res.status(200).json({
            success: true,
            summary: {
                averageRating: result.ratingStats.averageRating || 0,
                totalReviews: result.ratingStats.totalReviews || 0
            },
            reviews: reviewsArray 
        });

    } catch (error) {
        console.error(`[Review Fetch Error]:`, error);
        return res.status(500).json({ 
            success: false, 
            message: "Internal server error while fetching reviews." 
        });
    }
};

// -----------------------------------------------------------------
// 5. ANALYTICS & DASHBOARD APIs
// -----------------------------------------------------------------

/**
 * GET: User Dashboard Stats (Listings + Leads)
 */
exports.getDashboardData = async (req, res) => {
    const userId = req.userId;

    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized dashboard access." });
    }

    try {
        const dashboardStats = await flatmateListingService.getUserDashboardStats(userId);
        
        return res.status(200).json({
            success: true,
            data: {
                listings: dashboardStats.userListings,
                recentLeads: dashboardStats.recentLeads,
                summary: {
                    totalListings: dashboardStats.userListings.length,
                    totalViews: dashboardStats.userListings.reduce((acc, curr) => acc + (curr.analytics?.views || 0), 0),
                    totalLeads: dashboardStats.userListings.reduce((acc, curr) => acc + (curr.analytics?.inquiryCount || 0), 0)
                }
            }
        });
    } catch (error) {
        console.error(`[Dashboard Controller Error]:`, error);
        return res.status(500).json({
            success: false,
            message: "Failed to load dashboard data.",
            error: error.message
        });
    }
};