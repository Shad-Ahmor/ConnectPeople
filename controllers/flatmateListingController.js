// flatmateListingController.js

const flatmateListingService = require('../services/flatmateListingService.js');

// Existing POST API
exports.flatmateListing = async (req, res) => {
    const userId = req.userId; // From middleware
    const listingDetails = req.body;

    if (!userId) {
        return res.status(401).json({
            message: "Authentication error. User ID missing after middleware.",
            field: "auth_required"
        });
    }

    try {
        const { listingId, data } = await flatmateListingService.createNewListing(userId, listingDetails);

        res.status(201).json({
            message: "Listing submitted successfully and is pending review.",
            listingId,
            data
        });

    } catch (error) {
        // Handle validation errors
        if (error.message.includes("is required") ||
            error.message.includes("valid positive number") ||
            error.message.includes("image links")) {
            return res.status(400).json({ message: error.message });
        }

        console.error("Error submitting listing:", error);
        res.status(500).json({
            message: "Failed to submit listing due to a server error.",
            error: error.message
        });
    }
};

// -----------------------------------------------------------------
// NEW FETCH APIs
// -----------------------------------------------------------------

exports.fetchAllListings = async (req, res) => {
    try {
        // 🌟 MODIFICATION 1: Extract ALL filters from the request body
        const filters = {
            listingType: req.body.type, // Map 'type' (from frontend) to 'listingType'
            city: req.body.city,
            bhkType: req.body.bhkType, // This is an array
            propertyStatus: req.body.propertyStatus,
            houseType: req.body.houseType,
            searchQuery: req.body.searchText, // Map 'searchText' (from frontend) to 'searchQuery'
            radiusKm: req.body.searchRangeKm, // Map 'searchRangeKm' (from frontend) to 'radiusKm'
            location: req.body.currentLocation, // { lat: ..., lng: ... }
        };

        if (!filters.listingType) {
            // Validate the required input
            return res.status(400).json({ message: "Listing type (type) is required in the request body." });
        }

        // 🌟 MODIFICATION 2: Pass the entire filters object to the service layer
        const listings = await flatmateListingService.getAllListingsForFrontend(filters); 
        
        // Ensure the response format is { listings: [...] } as expected by the client
        res.status(200).json({ listings }); 
    } catch (error) {
        console.error("Error fetching all listings:", error);
        res.status(500).json({ message: "Failed to fetch listings.", error: error.message });
    }
};

exports.getAllListingsForFrontend = async (filters) => { 
    // 🌟 MODIFICATION 1: Destructure all filters from the input object
    const { 
        listingType, 
        city, 
        bhkType, 
        propertyStatus, 
        houseType, 
        searchQuery, 
        radiusKm, 
        location 
    } = filters;

    // --- Initialization ---
    const allUsersRef = db.ref('/flatmate/users');
    const snapshot = await allUsersRef.once('value');
    const usersData = snapshot.val() || {};

    let allListings = [];

    // --- Filter Normalization (Normalize values for case-insensitive matching) ---
    const normalizedFilterType = listingType ? listingType.toLowerCase().trim() : null;
    const normalizedCity = city ? city.toLowerCase().trim() : null;
    const normalizedPropertyStatus = propertyStatus ? propertyStatus.toLowerCase().trim() : null;
    const normalizedHouseType = houseType ? houseType.toLowerCase().trim() : null;
    const normalizedSearchQuery = searchQuery ? searchQuery.toLowerCase().trim() : null;

    for (const userId in usersData) {
        const userData = usersData[userId];
        const properties = userData.property || {};

        for (const listingId in properties) {
            const listingData = properties[listingId];
            
            let passesFilters = true; // Assume pass initially

            // 1. Filter by Listing Type (Mandatory Check from Controller)
            const listingGoal = listingData.listing_goal ? listingData.listing_goal.toLowerCase().trim() : '';
            if (normalizedFilterType && listingGoal !== normalizedFilterType) {
                continue; // Skip the listing if it doesn't match the primary type
            }

            // --- START ADDITIONAL FILTERING LOGIC ---

            // 2. Filter by City
            if (passesFilters && normalizedCity) {
                const listingCity = listingData.address?.city?.toLowerCase().trim();
                if (listingCity !== normalizedCity) {
                    passesFilters = false;
                }
            }

            // 3. Filter by BHK/Room Type (Checking if any selected BHK type matches the listing's BHK type)
            if (passesFilters && bhkType && bhkType.length > 0) {
                const listingBhk = listingData.bhk_or_rooms ? listingData.bhk_or_rooms.toLowerCase().trim() : null;
                const normalizedBhkTypes = bhkType.map(bhk => bhk.toLowerCase().trim());
                
                if (!listingBhk || !normalizedBhkTypes.includes(listingBhk)) {
                    passesFilters = false;
                }
            }

            // 4. Filter by Property Status
            if (passesFilters && normalizedPropertyStatus) {
                const listingStatus = listingData.property_status ? listingData.property_status.toLowerCase().trim() : null;
                if (listingStatus !== normalizedPropertyStatus) {
                    passesFilters = false;
                }
            }
            
            // 5. Filter by House Type
            if (passesFilters && normalizedHouseType) {
                const listingHouseType = listingData.property_type ? listingData.property_type.toLowerCase().trim() : null;
                if (listingHouseType !== normalizedHouseType) {
                    passesFilters = false;
                }
            }

            // 6. Filter by Search Query (Checking title, locality, or landmark for the search term)
            if (passesFilters && normalizedSearchQuery) {
                const searchFields = [
                    listingData.title,
                    listingData.address?.locality,
                    listingData.address?.landmark,
                    listingData.address?.city // Include city in search
                ].filter(Boolean).join(' ').toLowerCase(); // Join all fields into one string

                if (!searchFields.includes(normalizedSearchQuery)) {
                    passesFilters = false;
                }
            }

            // 7. Filter by Location and Radius (GEOSPATIAL FILTERING - Placeholder)
            if (passesFilters && location && location.lat && location.lng && radiusKm && radiusKm > 0) {

            }
            // If the listing fails any filter check, continue to the next listing
            if (!passesFilters) {
                continue;
            }

            // If it passes all filters, format and add it to the list
            const limitedData = FlatmateListingModel.toLimitedFrontendData(listingData, listingId);
            allListings.push(limitedData);
        }
    }
    return allListings;
};
// 2. Fetch single listing by ID with full details
exports.fetchSingleListing = async (req, res) => {
    const { listingId } = req.params;
    
    // इनपुट वैलिडेशन (Input Validation)
    if (!listingId) {
        return res.status(400).json({ 
            message: "Bad Request: Listing ID is required in the URL." 
        });
    }

    try {
        const listing = await flatmateListingService.getSingleListing(listingId);
        
        if (!listing) {
            // 404: Listing not found in the database (Service returns null)
            console.warn(`[API WARN] Listing ID ${listingId} not found in the database.`);
            return res.status(404).json({ 
                message: "Listing not found. Please verify the provided ID." 
            });
        }
        
        // 200 OK: Listing successfully retrieved
        return res.status(200).json(listing);

    } catch (error) {
        // 500: Internal Server Error (Database connection issue, model failure, etc.)
        console.error(`[API ERROR] Failed to fetch listing ${listingId}:`, error.message, error.stack);
        
        return res.status(500).json({ 
            message: "Internal Server Error: Failed to retrieve listing details from the database.", 
            errorDetail: error.message 
        });
    }
};
// 3. Fetch user's own listings
exports.fetchUserListings = async (req, res) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: "User not authenticated." });
    }
    try {
        // Fetch all of the user's listings and return them in a limited view
        const listings = await flatmateListingService.getUserListings(userId); 
        res.status(200).json(listings);
    } catch (error) {
        console.error(`Error fetching user ${userId} listings:`, error);
        res.status(500).json({ message: "Failed to fetch your listings.", error: error.message });
    }
};


// -----------------------------------------------------------------
// NEW MODIFY APIs (UPDATE/DELETE)
// -----------------------------------------------------------------

exports.updateListing = async (req, res) => {
    // 💡 नोट: req.userId को authController.protect द्वारा सेट किया जाना चाहिए।
    const userId = req.userId;
    const { listingId } = req.params; // ✅ यहाँ से ID को URL से सही ढंग से प्राप्त किया जाता है
    const updates = req.body;

    if (!userId) {
        return res.status(401).json({ message: "User not authenticated." });
    }

    try {
        const updatedData = await flatmateListingService.updateUserListing(userId, listingId, updates);
        
        if (!updatedData) {
            return res.status(404).json({ message: "Listing not found or you do not have permission to modify it." });
        }

        res.status(200).json({
            message: "Listing updated successfully.",
            listingId,
            data: updatedData
        });

    } catch (error) {
       // ... error handling ...
        console.error(`Error updating listing ${listingId}:`, error);
        res.status(500).json({
            message: "Failed to update listing due to a server error.",
            error: error.message
        });
    }
};

// Delete Listing (Only user's own property)
exports.deleteListing = async (req, res) => {
    const userId = req.userId;
    const { listingId } = req.params;

    if (!userId) {
        return res.status(401).json({ message: "User not authenticated." });
    }

    try {
        const success = await flatmateListingService.deleteUserListing(userId, listingId);
        
        if (!success) {
            // This includes cases where the listing doesn't exist under this user
            return res.status(404).json({ message: "Listing not found or you do not have permission to delete it." });
        }

        res.status(200).json({
            message: "Listing deleted successfully.",
            listingId
        });

    } catch (error) {
        console.error(`Error deleting listing ${listingId}:`, error);
        res.status(500).json({
            message: "Failed to delete listing due to a server error.",
            error: error.message
        });
    }
};