const { db } = require('../config/firebaseConfig.js');
// IMPORT NOTE: Ensuring we use the new Model name correctly
const FlatmatePropertyModel = require('../models/flatmatePropertyModel.js');

/**
 * --------------------------------------------------------------------------------
 * 1. CORE LISTING FUNCTIONS (CRUD)
 * --------------------------------------------------------------------------------
 */

// Create New Listing
exports.createNewListing = async (userId, listingData) => {
    if (!userId) throw new Error("Authentication error: User ID missing.");

    console.log(`[Service] Creating new listing for user: ${userId}`);

    // Validate & format listing using the NEW Model logic
    // Model automatically handles: rent parsing, image validation, default values
    const listingModel = new FlatmatePropertyModel(listingData);
    const finalListing = listingModel.toRTDBData(userId);

    // Save to RTDB path: /flatmate/users/{userId}/property/{listingId}
    const userPropertyRef = db.ref(`/flatmate/users/${userId}/property`);
    const newListingRef = userPropertyRef.push(); 
    
    try {
        await newListingRef.set(finalListing);
        
        // Return structured data for immediate frontend update
        return {
            listingId: newListingRef.key,
            data: listingModel.toFrontendData(newListingRef.key)
        };
    } catch (error) {
        console.error(`[Fatal Error] RTDB Save Failed:`, error.message);
        throw new Error("Failed to save property to database.");
    }
};

// API 1: Fetch all listings with advanced filtering & normalization
exports.getAllListingsForFrontend = async (filters) => { 
    // 1. BHK Mapping for consistent numeric comparison
    const bhkMapping = {
        '1 rk': 0.5, '1 bhk': 1, '2 bhk': 2, '3 bhk': 3, '4 bhk': 4, '5+ bhk': 5
    };

    // 2. Fetch all users (Admin SDK allows traversing all properties)
    const allUsersRef = db.ref('/flatmate/users');
    const snapshot = await allUsersRef.once('value');
    const usersData = snapshot.val() || {};

    let allListings = [];

    // 3. Normalization logic for Filter Inputs
    const normalizedPropertyType = filters.propertyType && filters.propertyType !== 'all' 
        ? filters.propertyType.toLowerCase().trim() : null;
    
    const normalizedGoal = filters.type && filters.type !== 'all' 
        ? String(filters.type).toLowerCase().trim() : null;
    
    const normalizedCity = filters.city ? String(filters.city).toLowerCase().trim() : null;
    
    const normalizedBhkNumbers = Array.isArray(filters.bhkType)
        ? filters.bhkType.map(bhk => bhkMapping[bhk.toLowerCase().trim()]).filter(n => n !== undefined)
        : [];

    const maxRent = filters.maxRent ? parseFloat(filters.maxRent) : null;
    const maxDeposit = filters.maxDeposit ? parseFloat(filters.maxDeposit) : null;
    
    // Detailed Filter Params
    const selectedFurnishing = filters.furnishing && filters.furnishing !== 'Any' ? filters.furnishing.toLowerCase() : null;
    const selectedParking = filters.parking && filters.parking !== 'Any' ? filters.parking.toLowerCase() : null;
    const selectedFacing = filters.facing && filters.facing !== 'Any' ? filters.facing.toLowerCase() : null;
    const selectedGender = filters.gender && filters.gender !== 'Any' ? filters.gender.toLowerCase() : null;

    // 4. Main Filtering Loop (O(N*M) - Traverse all properties)
    for (const userId in usersData) {
        const properties = usersData[userId].property || {};
        
        for (const listingId in properties) {
            const listingData = properties[listingId];
            let passesFilters = true;

            // --- A. Status Check (Security Guard) ---
            const listingStatus = (listingData.status || 'unknown').toLowerCase().trim();
            if (listingStatus !== 'approved' && listingStatus !== 'pending review') continue;

            // --- B. Property Type Filter ---
            const listingPropertyType = (listingData.propertyType || '').toLowerCase().trim();
            if (normalizedPropertyType && listingPropertyType !== normalizedPropertyType) passesFilters = false;

            // --- C. Listing Goal Fix (Handling 'Flatmate' specific logic) ---
            if (passesFilters && normalizedGoal) {
                const listingGoal = (listingData.listing_goal || '').toLowerCase().trim();
                if (normalizedGoal === 'flatmate') {
                    if (listingGoal !== 'flatmate' && listingPropertyType !== 'flatmate') passesFilters = false;
                } else {
                    if (!listingGoal.includes(normalizedGoal)) passesFilters = false;
                }
            }

            // --- D. City Filter ---
            if (passesFilters && normalizedCity) {
                const listingCity = (listingData.city || '').toLowerCase().trim();
                if (listingCity !== normalizedCity) passesFilters = false;
            }

            // --- E. BHK/Rooms Filter ---
            if (passesFilters && normalizedBhkNumbers.length > 0) {
                const listingBedroom = parseFloat(listingData.bedrooms) || 0; 
                const matchesBhk = normalizedBhkNumbers.some(num => {
                    if (num === 5) return listingBedroom >= 5;
                    return listingBedroom === num;
                });
                if (!matchesBhk) passesFilters = false;
            }

            // --- F. Search Text Keyword Filter (Area, Description, City) ---
            if (passesFilters && filters.searchText) {
                const searchLower = filters.searchText.toLowerCase();
                const fieldsToSearch = [
                    listingData.city, 
                    listingData.area, 
                    listingData.location, 
                    listingData.description,
                    listingData.propertyType,
                    listingData.listing_goal
                ].filter(Boolean).join(' ').toLowerCase();
                
                if (!fieldsToSearch.includes(searchLower)) passesFilters = false;
            }

            // --- G. Financial Filters (Rent & Deposit) ---
            if (passesFilters && maxRent && maxRent < 200000) {
                const listingRent = parseFloat(listingData.rent) || 0;
                if (listingRent > maxRent) passesFilters = false;
            }
            if (passesFilters && maxDeposit && maxDeposit < 500000) {
                const listingDeposit = parseFloat(listingData.deposit) || 0;
                if (listingDeposit > maxDeposit) passesFilters = false;
            }

            // --- H. Advanced Lifestyle Filters ---
            if (passesFilters && selectedFurnishing) {
                if ((listingData.furnishing_status || '').toLowerCase().trim() !== selectedFurnishing) passesFilters = false;
            }
            if (passesFilters && selectedParking) {
                const listingParking = (listingData.parking || '').toLowerCase().trim();
                if (selectedParking === 'both') {
                    if (!listingParking.includes('car') && !listingParking.includes('bike') && listingParking !== 'both') passesFilters = false;
                } else if (!listingParking.includes(selectedParking)) passesFilters = false;
            }
            if (passesFilters && selectedFacing) {
                if ((listingData.facing || '').toLowerCase().trim() !== selectedFacing) passesFilters = false;
            }
            if (passesFilters && selectedGender) {
                const listingGender = (listingData.preferred_gender || 'any').toLowerCase();
                if (listingGender !== 'any' && listingGender !== selectedGender) passesFilters = false;
            }

            // --- I. Final Push ---
            if (passesFilters) {
                // Formatting data using the Static Model Helper
                const limitedData = FlatmatePropertyModel.toLimitedFrontendData(listingData, listingId, userId);
                allListings.push(limitedData);
            }
        }
    }

    // 5. Sorting Logic (Matches Frontend Redux sorting)
    if (filters.sortBy && allListings.length > 0) {
        allListings.sort((a, b) => {
            const priceA = parseFloat(String(a.rent).replace(/[^0-9.-]+/g,"")) || 0;
            const priceB = parseFloat(String(b.rent).replace(/[^0-9.-]+/g,"")) || 0;
            
            if (filters.sortBy === 'rent_low') return priceA - priceB;
            if (filters.sortBy === 'rent_high') return priceB - priceA;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
    }

    return allListings;
};
// API 2: Fetch single listing with FULL details (Traverses users to find ID)
// Logic preserved exactly from your React Native Client logic
exports.getSingleListing = async (listingId) => {
    try {
        // 1. Pure "users" node ka reference lein (Firebase Admin SDK)
        const allUsersRef = db.ref('/flatmate/users');
        const snapshot = await allUsersRef.once('value');

        if (!snapshot.exists()) {
            throw new Error("No users found in the database.");
        }

        const usersData = snapshot.val();
        let foundListing = null;
        let ownerDetails = null;

        // 2. Loop through all users (Aapke backend logic ki tarah logic preserved)
        for (const userId in usersData) {
            const userData = usersData[userId];
            // Safe access: property node check
            const properties = userData.property;
            
            // Agar is user ke paas properties hain aur hamari listingId yahan hai
            if (properties && properties[listingId]) {
                foundListing = properties[listingId];
                
                // Logic strictly preserved from your React Native snippet
                ownerDetails = {
                    ownerName: userData.name || userData.fullName || "N/A",
                    ownerPhone: userData.phoneNumber || userData.phone || "N/A", // Prioritizing your new structure
                    ownerId: userId,
                    ownerEmail: userData.email || ""
                };

                break; 
            }
        }

        // 3. Result Check
        if (!foundListing) {
            console.warn(`[RTDB Service] Listing ${listingId} not found in any user node.`);
            return null; // Return null to trigger 404 in controller
        }

        // Helper function (preserved exactly) to ensure frontend gets arrays
        const ensureArray = (data) => {
            if (!data) return [];
            if (Array.isArray(data)) return data;
            if (typeof data === 'object') return Object.values(data);
            return [];
        };

        // 4. Data return karein (Constructing response just like your client function)
        return {
            ...foundListing,
            id: listingId,
            ...ownerDetails,
            flooring_type: ensureArray(foundListing.flooring_type),
            image_links: ensureArray(foundListing.image_links || foundListing.imageLinks),
            amenities: ensureArray(foundListing.amenities),
            transit_points: ensureArray(foundListing.transit_points),
            essential_points: ensureArray(foundListing.essential_points),
            utility_points: ensureArray(foundListing.utility_points)
        };

    } catch (error) {
        console.error(`[Service Error] searching for listing ${listingId}:`, error);
        throw new Error(error.message || "Failed to fetch property details.");
    }
};

// API 3: Fetch all listings for a specific owner
exports.getUserListings = async (userId) => {
    const userPropertiesRef = db.ref(`/flatmate/users/${userId}/property`);
    const snapshot = await userPropertiesRef.once('value');
    const properties = snapshot.val() || {};
    
    const userListings = [];
    for (const listingId in properties) {
        const listingData = properties[listingId];
        // Using static helper for consistent list-view structure
        const listing = FlatmatePropertyModel.toLimitedFrontendData(listingData, listingId, userId);
        userListings.push(listing);
    }
    return userListings;
};

/**
 * --------------------------------------------------------------------------------
 * 2. MODIFY SERVICE FUNCTIONS (Update/Delete)
 * --------------------------------------------------------------------------------
 */

exports.updateUserListing = async (userId, listingId, updates) => {
    if (!userId || !listingId) throw new Error("Missing User ID or Listing ID");

    const listingRef = db.ref(`/flatmate/users/${userId}/property/${listingId}`);
    const snapshot = await listingRef.once('value');
    
    if (!snapshot.exists()) return null;

    // 1. Filter allowed fields based on UNIQUE_DATA_FIELDS from Model
    const updatableFields = FlatmatePropertyModel.UNIQUE_DATA_FIELDS;
    const allowedUpdates = {};

    for (const key in updates) {
        if (updatableFields.includes(key)) {
            allowedUpdates[key] = updates[key];
        }
    }

    // 2. Strict Image Protection
    if (allowedUpdates.hasOwnProperty('imageLinks')) {
        if (!Array.isArray(allowedUpdates.imageLinks) || allowedUpdates.imageLinks.length === 0) {
            delete allowedUpdates.imageLinks; 
        }
    }

    // 3. Forced Numeric Casting for RTDB Integrity
    const numericFields = [
        'rent', 'deposit', 'bedrooms', 'bathrooms', 'building_age', 
        'maintenance_charges', 'max_negotiable_rent', 'negotiation_margin_percent', 'current_occupants'
    ];
    numericFields.forEach(field => {
        if (allowedUpdates[field] !== undefined) {
            allowedUpdates[field] = Number(allowedUpdates[field]) || 0;
        }
    });

    // 4. Boolean Consistency
    if (allowedUpdates.gated_security !== undefined) allowedUpdates.gated_security = !!allowedUpdates.gated_security;
    if (allowedUpdates.is_no_brokerage !== undefined) allowedUpdates.is_no_brokerage = !!allowedUpdates.is_no_brokerage;

    allowedUpdates.updatedAt = new Date().toISOString(); 
    
    try {
        await listingRef.update(allowedUpdates);
        
        // Re-fetch and use Model to return formatted response
        const updatedSnapshot = await listingRef.once('value');
        const model = new FlatmatePropertyModel(updatedSnapshot.val()); 
        return model.toFrontendFullData(listingId);
    } catch (error) {
        console.error(`[updateUserListing Error]:`, error.message);
        throw new Error("Database update failed.");
    }
};

exports.deleteUserListing = async (userId, listingId) => {
    const listingRef = db.ref(`/flatmate/users/${userId}/property/${listingId}`);
    const snapshot = await listingRef.once('value');
    if (!snapshot.exists()) return false;

    await listingRef.remove();
    return true;
};

/**
 * --------------------------------------------------------------------------------
 * 3. REVIEW & RATING SERVICE FUNCTIONS
 * --------------------------------------------------------------------------------
 */

const getOwnerIdByPropertyId = async (listingId) => {
    const allUsersRef = db.ref('/flatmate/users');
    const snapshot = await allUsersRef.once('value');
    const users = snapshot.val() || {};
    for (const uid in users) {
        if (users[uid].property && users[uid].property[listingId]) return uid;
    }
    return null;
};

const recalculateRatingStats = async (propertyRef) => {
    const reviewsSnapshot = await propertyRef.child('reviews').once('value');
    const reviews = reviewsSnapshot.val() || {};
    const reviewsArray = Object.values(reviews);
    const totalReviews = reviewsArray.length;
    
    if (totalReviews === 0) {
        await propertyRef.child('ratingStats').set({ averageRating: 0, totalReviews: 0 });
        await propertyRef.child('rating').set("0.0");
        return;
    }

    const sum = reviewsArray.reduce((acc, curr) => acc + (curr.rating || 0), 0);
    const averageRating = parseFloat((sum / totalReviews).toFixed(1));

    await propertyRef.child('ratingStats').set({ averageRating, totalReviews });
    await propertyRef.child('rating').set(String(averageRating));
};

exports.addOrUpdateReview = async (listingId, reviewerId, reviewData) => {
    const ownerId = await getOwnerIdByPropertyId(listingId);
    if (!ownerId) throw new Error("Property not found.");

    const propertyRef = db.ref(`/flatmate/users/${ownerId}/property/${listingId}`);
    const newReview = {
        userId: reviewerId,
        userName: reviewData.userName || 'Anonymous',
        userImage: reviewData.userImage || '',
        rating: Number(reviewData.rating) || 0,
        comment: reviewData.comment || '',
        timestamp: Date.now()
    };

    await propertyRef.child(`reviews/${reviewerId}`).set(newReview);
    await recalculateRatingStats(propertyRef);
    return newReview;
};

exports.deleteReview = async (listingId, reviewerId) => {
    const ownerId = await getOwnerIdByPropertyId(listingId);
    if (!ownerId) throw new Error("Property not found.");

    const propertyRef = db.ref(`/flatmate/users/${ownerId}/property/${listingId}`);
    await propertyRef.child(`reviews/${reviewerId}`).remove();
    await recalculateRatingStats(propertyRef);
    return true;
};

exports.getPropertyReviews = async (listingId) => {
    const ownerId = await getOwnerIdByPropertyId(listingId);
    if (!ownerId) return null;

    const propertyRef = db.ref(`/flatmate/users/${ownerId}/property/${listingId}`);
    const snapshot = await propertyRef.once('value');
    const data = snapshot.val();
    if (!data) return null;

    return {
        reviews: data.reviews || {},
        ratingStats: data.ratingStats || { averageRating: 0, totalReviews: 0 }
    };
};

/**
 * --------------------------------------------------------------------------------
 * 4. ANALYTICS & DASHBOARD
 * --------------------------------------------------------------------------------
 */

exports.getUserDashboardStats = async (userId) => {
    try {
        const userPropertiesRef = db.ref(`flatmate/users/${userId}/property`);
        const visitsRef = db.ref(`flatmate/users/${userId}/notifications/visits`);

        const [propSnap, visitSnap] = await Promise.all([
            userPropertiesRef.once('value'),
            visitsRef.once('value')
        ]);

        const properties = propSnap.val() || {};
        const visitsData = visitSnap.val() || {};
        const allVisits = Object.values(visitsData);

        const userListings = Object.keys(properties).map(listingId => {
            const listingData = properties[listingId];
            const thisListingVisits = allVisits.filter(v => v.listingId === listingId);

            const analytics = {
                inquiryCount: thisListingVisits.filter(v => v.isInterestedLead === true).length,
                views: thisListingVisits.length
            };

            // Formatting with model for dashboard consistency
            const formatted = FlatmatePropertyModel.toLimitedFrontendData(listingData, listingId, userId);
            return { ...formatted, analytics };
        });

        const recentLeads = allVisits
            .map((v, index) => ({
                id: v.timestamp ? v.timestamp.toString() : index.toString(),
                name: v.visitorName || 'Guest User',
                property: v.propertyTitle || 'Property Listing',
                status: v.isInterestedLead === true ? 'Interested' : 'Visited',
                phone: v.visitorPhone || 'No Contact', 
                timestamp: v.timestamp,
                listingId: v.listingId
            }))
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
            .slice(0, 50);

        return { userListings, recentLeads };
    } catch (error) {
        console.error("Dashboard Service Error:", error);
        throw error;
    }
};