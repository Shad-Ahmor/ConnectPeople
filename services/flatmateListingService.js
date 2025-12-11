// flatmateListingService.js

const { db } = require('../config/firebaseConfig.js');
const { FlatmateListingModel } = require('../models/flatmateListingModel.js');

// Existing createNewListing function
exports.createNewListing = async (userId, listingData) => {
    if (!userId) throw new Error("Authentication error: User ID missing.");

    // Validate & format listing
    const listingModel = new FlatmateListingModel(listingData);
    const finalListing = listingModel.toRTDBData(userId);

    // Save to RTDB: /flatmate/users/{userId}/property/{listingId}
    const userPropertyRef = db.ref(`/flatmate/users/${userId}/property`);
    const newListingRef = userPropertyRef.push(); // Generates unique ID
    await newListingRef.set(finalListing);

    // Return minimal safe data for frontend
    return {
        listingId: newListingRef.key,
        data: listingModel.toFrontendData(newListingRef.key)
    };
};

// -----------------------------------------------------------------
// NEW FETCH SERVICE FUNCTIONS
// -----------------------------------------------------------------
// API 1: Fetch all listings with limited details
exports.getAllListingsForFrontend = async (filters) => { // 🌟 FIX 1: Accept 'filters' object instead of 'listingTypeFilter' string
    
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
    // 🌟 FIX 2: Use listingType from the destructured object.
    const normalizedFilterType = listingType ? listingType.toLowerCase().trim() : null;
    const normalizedCity = city ? city.toLowerCase().trim() : null;
    const normalizedPropertyStatus = propertyStatus ? propertyStatus.toLowerCase().trim() : null;
    const normalizedHouseType = houseType ? houseType.toLowerCase().trim() : null;
    const normalizedSearchQuery = searchQuery ? searchQuery.toLowerCase().trim() : null;

    // INEFFICIENT: Iterating through all users to find all listings
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
                // ... Geospatial Logic Placeholder ...
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

// API 2: Fetch a single listing by ID with full details
exports.getSingleListing = async (listingId) => {
    // ⚠️ दक्षता चेतावनी:
    // यह फ़ंक्शन अभी भी 'flatmate/users' के नीचे सभी उपयोगकर्ताओं के डेटा को खींचता है
    // और अज्ञात userId के कारण क्लाइंट-साइड (या सर्वर-साइड) लूपिंग पर निर्भर करता है।
    // बड़े डेटाबेस के लिए, प्रदर्शन समस्याओं से बचने के लिए /listings/{listingId} का एक अलग इंडेक्स बनाएं।
    
    try {
        const allUsersRef = db.ref('/flatmate/users');
        
        // 1. डेटाबेस से सभी उपयोगकर्ता डेटा प्राप्त करें
        const snapshot = await allUsersRef.once('value');
        const usersData = snapshot.val() || {};

        // 2. प्रत्येक उपयोगकर्ता के माध्यम से लिस्टिंग को लूप करें
        for (const userId in usersData) {
            // सुनिश्चित करें कि उपयोगकर्ता ऑब्जेक्ट मौजूद है और उसमें 'property' है
            const properties = usersData[userId].property || {};
            const listingData = properties[listingId];

            if (listingData && typeof listingData === 'object') {
                // लिस्टिंग मिली। इसे FlatmateListingModel का उपयोग करके फॉर्मेट करें।
                // सुरक्षा: सुनिश्चित करें कि data object है
                const listingModel = new FlatmateListingModel(listingData);
                return listingModel.toFrontendFullData(listingId);
            }
        }
        
        // 3. लिस्टिंग नहीं मिली (यह 404 त्रुटि का कारण बनेगा, जिसे कंट्रोलर हैंडल करेगा)
        return null; 

    } catch (error) {
        // डेटाबेस या किसी अन्य अवांछित त्रुटि को कैप्चर करें
        console.error(`[getSingleListing Service Error] Failed to retrieve or process listing ${listingId}:`, error.message);
        // त्रुटि को कॉल करने वाले कंट्रोलर तक प्रचारित (propagate) करें, जो 500 स्टेटस भेज सकता है
        throw new Error("Failed to perform database lookup for single listing.");
    }
};

// API 3: Fetch all listings for a specific user
exports.getUserListings = async (userId) => {
    const userPropertiesRef = db.ref(`/flatmate/users/${userId}/property`);
    const snapshot = await userPropertiesRef.once('value');
    const properties = snapshot.val() || {};
    
    const userListings = [];
    
    for (const listingId in properties) {
        const listingData = properties[listingId];
        // Limited view is generally enough for the user's dashboard list
        const listing = FlatmateListingModel.toLimitedFrontendData(listingData, listingId);
        userListings.push(listing);
    }
    
    return userListings;
};

// -----------------------------------------------------------------
// NEW MODIFY SERVICE FUNCTIONS
// -----------------------------------------------------------------

// PATCH/UPDATE: Update user's own listing
exports.updateUserListing = async (userId, listingId, updates) => {
    // Access the listing directly using the authenticated userId (ensures ownership)
    const listingRef = db.ref(`/flatmate/users/${userId}/property/${listingId}`);
    const snapshot = await listingRef.once('value');
    
    if (!snapshot.exists()) {
        return false;
    }

    // Only allow specific fields to be updated
    const allowedUpdates = {};
    const updatableFields = [
        'price', 'deposit', 'description', 'final_available_date', 
        'current_occupants', 'furnishing_status', 'selectedAmenities', 
        'is_no_brokerage', 'max_negotiable_price', 'negotiation_margin_percent',
        'preferred_gender', 'preferred_occupation', 'preferred_work_location', 
        'imageLinks', 'location', 'bedrooms', 'bathrooms', 'carpetArea'
    ];

    for (const key in updates) {
        if (updatableFields.includes(key)) {
            allowedUpdates[key] = updates[key];
        }
    }

    if (Object.keys(allowedUpdates).length === 0) {
        throw new Error("Invalid update data: No updatable fields provided.");
    }
    
    // Update the timestamp
    allowedUpdates.updatedAt = new Date().toISOString(); 
    
    await listingRef.update(allowedUpdates);

    // Fetch the updated data to return to the frontend
    const updatedSnapshot = await listingRef.once('value');
    const updatedListingData = updatedSnapshot.val();

    // Use the model to format the full data response
    const model = new FlatmateListingModel(updatedListingData); 
    return model.toFrontendFullData(listingId);
};


// DELETE: Delete user's own listing
exports.deleteUserListing = async (userId, listingId) => {
    // Access the listing directly using the authenticated userId (ensures ownership)
    const listingRef = db.ref(`/flatmate/users/${userId}/property/${listingId}`);
    const snapshot = await listingRef.once('value');

    if (!snapshot.exists()) {
        return false;
    }

    // Delete the listing
    await listingRef.remove();
    
    return true;
};