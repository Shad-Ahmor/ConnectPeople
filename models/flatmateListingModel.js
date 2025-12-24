// flatmateListingModel.js

class FlatmateListingModel {
    constructor(data) {
        // 💡 HELPER FUNCTION: किसी भी संभावित नाम (क्लाइंट या DB) से फ़ील्ड वैल्यू प्राप्त करें
        const getFieldValue = (clientName, dbName) => data[dbName] || data[clientName];

        // ------------------------------------
        // --- Core Validation (MAPPING APPLIED) ---
        // ------------------------------------
        if (!data.location) throw new Error("Location is required for the listing.");
        
        // 🔥 FIX 1: Price को DB ('rent') या Client ('rent') से प्राप्त करें
        const rawPrice = getFieldValue('rent', 'rent');
        if (!rawPrice) throw new Error("Price is required for the listing (Price/Rent field missing).");
        
        if (!data.listing_goal) throw new Error("Listing Goal is required (e.g., Rent, Sell).");
        
        // 🔥 FIX 2: Furnishing Status को DB ('furnishing_status') या Client ('furnishing_type') से प्राप्त करें
        const rawFurnishingStatus = getFieldValue('furnishing_type', 'furnishing_status');
        if (!rawFurnishingStatus) throw new Error("Furnishing Status is required for the listing.");
        
        if (!data.deposit) throw new Error("Deposit amount is required.");

        // Price validation (अब यह 'rawPrice' का उपयोग करता है जो 'rent' या 'rent' हो सकता है)
        const parsedPrice = parseFloat(rawPrice);
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
            throw new Error("Price must be a valid positive number.");
        }

        // Deposit validation
        const parsedDeposit = parseFloat(data.deposit);
        if (isNaN(parsedDeposit) || parsedDeposit < 0) {
            throw new Error("Deposit must be a valid number.");
        }
        
        // 🔥 FIX 3: Image Links को DB ('imageLinks') या Client ('image_links') से प्राप्त करें
        const rawImageLinks = getFieldValue('image_links', 'imageLinks');
        const validImageLinks = Array.isArray(rawImageLinks)
            ? rawImageLinks.filter(link => typeof link === 'string' && link.trim() !== '')
            : [];
        if (validImageLinks.length < 3) {
            // नोट: यदि आप हमेशा डेटाबेस से Fetch कर रहे हैं, तो यह त्रुटि आपको यह संकेत दे सकती है
            // कि डेटाबेस में 'imageLinks' फ़ील्ड का नाम गलत है या उसमें डेटा कम है।
            throw new Error("At least 3 valid public image links are required.");
        }

        // ------------------------------------
        // --- Assign Core Fields (MAPPED & NEW) ---
        // ------------------------------------
        this.location = data.location;
        this.rent = parsedPrice; // Mapped from 'rent' or 'rent'
        this.deposit = parsedDeposit; 
        this.listing_goal = data.listing_goal; 
        this.imageLinks = validImageLinks; // Mapped from 'imageLinks' or 'image_links'
        
        // FIX 4: Use DB's 'propertyType' or client's 'property_type'
        this.propertyType = data.propertyType || data.property_type || 'Apartment';
        
        this.description = data.description || '';
        
        // Handle bedrooms being a string like '2 BHK' (Extract number)
        let parsedBedrooms = parseInt(data.bedrooms) || 0;
        if (isNaN(parsedBedrooms) && typeof data.bedrooms === 'string') {
             const match = data.bedrooms.match(/\d+/); 
             if (match) parsedBedrooms = parseInt(match[0]);
        }
        this.bedrooms = parsedBedrooms;

        this.bathrooms = parseInt(data.bathrooms) || 0;
        this.carpetArea = parseInt(data.carpetArea) || 0;
        
        // ------------------------------------
        // --- Assign Secondary Fields (MAPPED & NEW) ---
        // ------------------------------------
        // Mapped from client's 'furnishing_type' or DB's 'furnishing_status'
        this.furnishing_status = rawFurnishingStatus; 
        this.furnishing_details = data.furnishing_details || []; 
        
        // Mapped from client's 'available_date' or DB's 'final_available_date'
        this.final_available_date = data.final_available_date || data.available_date || 'Now'; 
        this.current_occupants = parseInt(data.current_occupants) || 0; 

        // Mapped from client's 'amenities' or DB's 'selectedAmenities'
        this.selectedAmenities = Array.isArray(data.selectedAmenities || data.amenities) 
                                 ? (data.selectedAmenities || data.amenities) : []; 

        // Derived logic
        this.is_flatmate_listing = (data.listing_goal === 'Flatmate'); 
        
        // Mapped from client's 'is_brokerage_free' or DB's 'is_no_brokerage'
        this.is_no_brokerage = !!(data.is_no_brokerage || data.is_brokerage_free); 
        
        this.max_negotiable_rent = parseFloat(data.max_negotiable_rent) || null; 
        
        // Mapped from client's 'negotiation_margin' (which is a string like '5') or DB's 'negotiation_margin_percent'
        this.negotiation_margin_percent = parseInt(data.negotiation_margin_percent || data.negotiation_margin) || 0; 
        
        this.preferred_gender = data.preferred_gender || 'Any'; 
        this.preferred_occupation = data.preferred_occupation || ''; 
        this.preferred_work_location = data.preferred_work_location || ''; 

        // ------------------------------------
        // --- ADDED NEW GRANULAR FIELDS (From Frontend Payload) ---
        // ------------------------------------
        // Step 2 Fields
        this.city = data.city || null;
        this.area = data.area || null;
        this.pincode = data.pincode || null;
        this.flat_number = data.flat_number || null;
        this.state_name = data.state_name || null;
        this.districtName = data.districtName || null;
        
        // Step 3 Fields
        this.building_age = parseInt(data.building_age) || 0;
        this.ownership_type = data.ownership_type || null;
        this.maintenance_charges = parseFloat(data.maintenance_charges) || 0;
        this.facing = data.facing || null;
        this.parking = data.parking || null;
        this.gated_security = data.gated_security === undefined ? true : !!data.gated_security;
        this.flooring_type = Array.isArray(data.flooring_type) ? data.flooring_type : [];
        this.nearby_location = data.nearby_location || null;


        // Step 7 Fields (Proximity POI)
        this.transit_points = Array.isArray(data.transit_points) ? data.transit_points : [];
        this.essential_points = Array.isArray(data.essential_points) ? data.essential_points : [];
        this.utility_points = Array.isArray(data.utility_points) ? data.utility_points : [];


        // ------------------------------------
        // --- System Fields (Unchanged) ---
        // ------------------------------------
        this.postedBy = data.postedBy || null; 
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || this.createdAt; 
        this.status = data.status || 'Pending Review';
        this.rating = data.rating || (Math.floor(Math.random() * 20) / 10 + 3.0).toFixed(1); 
    }

    // Helper to determine BHK or Room Count based on property type (Unchanged)
    getBhkOrRooms() {
        if (this.propertyType === 'Flat' || this.propertyType === 'Shared Flatmate' || this.propertyType.includes('BHK')) {
            return this.bedrooms + (this.bedrooms > 0 ? ' BHK' : ' RK');
        } else {
            // For PG/Hostel/House/Bunglow, sum beds/baths/etc.
            return `${this.bedrooms} Bedrooms`; 
        }
    }


    toRTDBData(userId) {
        this.postedBy = userId;
        return {
            // --- Core Fields ---
            location: this.location,
            rent: this.rent, // DB name
            deposit: this.deposit, 
            listing_goal: this.listing_goal,
            imageLinks: this.imageLinks, // DB name
            description: this.description,
            bedrooms: this.bedrooms,
            bathrooms: this.bathrooms,
            propertyType: this.propertyType,
            carpetArea: this.carpetArea, 
            
            // --- Existing Secondary Fields ---
            furnishing_status: this.furnishing_status, // DB name
            final_available_date: this.final_available_date,
            current_occupants: this.current_occupants,
            selectedAmenities: this.selectedAmenities,
            is_flatmate_listing: this.is_flatmate_listing,
            is_no_brokerage: this.is_no_brokerage,
            max_negotiable_rent: this.max_negotiable_rent,
            negotiation_margin_percent: this.negotiation_margin_percent,
            preferred_gender: this.preferred_gender,
            preferred_occupation: this.preferred_occupation,
            preferred_work_location: this.preferred_work_location,
            
            // --- ADDED NEW FIELDS (Step 2, 3, 7 for RTDB) ---
            // Step 2 Fields
            city: this.city,
            area: this.area,
            pincode: this.pincode,
            flat_number: this.flat_number,
            state_name: this.state_name,
            districtName: this.districtName,
            
            // Step 3 Fields
            building_age: this.building_age,
            ownership_type: this.ownership_type,
            maintenance_charges: this.maintenance_charges,
            facing: this.facing,
            parking: this.parking,
            gated_security: this.gated_security,
            flooring_type: this.flooring_type,
            nearby_location: this.nearby_location,

            // Step 7 Fields
            transit_points: this.transit_points,
            essential_points: this.essential_points,
            utility_points: this.utility_points,
            
            
            // --- System Fields ---
            postedBy: this.postedBy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            status: this.status,
            rating: this.rating
        };
    }

    // Existing minimal data for post response
    toFrontendData(listingId) {
        return {
            listingId,
            location: this.location,
            rent: this.rent,
            deposit: this.deposit,
            listing_goal: this.listing_goal,
            imageLinks: this.imageLinks,
            propertyType: this.propertyType,
            is_no_brokerage: this.is_no_brokerage,
            createdAt: this.createdAt,
            status: this.status
        };
    }

    // 🆕 API 1 (Limited Details) for public/user list view
    static toLimitedFrontendData(data, listingId) {
        // Static helper for bhkOrRooms (to be used in the static method above)
        const getBhkOrRoomsStatic = (data) => {
            if (data.propertyType === 'Flat' || data.propertyType === 'Shared Flatmate' || data.propertyType.includes('BHK')) {
                return data.bedrooms + (data.bedrooms > 0 ? ' BHK' : ' RK');
            } else {
                return `${(data.bedrooms || 0)} Bedrooms`; 
            }
        }
        
        return {
            listingId: listingId,
            rent: data.rent,
            image: data.imageLinks && data.imageLinks.length > 0 ? data.imageLinks[0] : null, // Only first image
            propertyType: data.propertyType,
            location: data.location,
            rating: data.rating || 'N/A',
            bathrooms: data.bathrooms,
            bedrooms: data.bedrooms,
            bhkOrRooms: getBhkOrRoomsStatic(data),
            totalCarpetAreaSqft: data.carpetArea || 'N/A',
            finalAvailableDate: data.final_available_date,
            listingGoal: data.listing_goal,
            isNoBrokerage: data.is_no_brokerage || false,
            status: data.status || 'N/A', 
            createdAt: data.createdAt
        };
    }


    // 🆕 API 2 & 4 (Complete Details) for single view/update response
    toFrontendFullData(listingId) {
        return {
            listingId,
            location: this.location,
            rent: this.rent,
            deposit: this.deposit,
            listingGoal: this.listing_goal,
            description: this.description,
            imageLinks: this.imageLinks, // All images
            
            propertyDetails: {
                propertyType: this.propertyType,
                bedrooms: this.bedrooms,
                bathrooms: this.bathrooms,
                bhkOrRooms: this.getBhkOrRooms(),
                totalCarpetAreaSqft: this.carpetArea || 'N/A',
                furnishingStatus: this.furnishing_status,
                furnishingDetails: this.furnishing_details,
                selectedAmenities: this.selectedAmenities,
                
                // --- Step 3 Details ---
                buildingAge: this.building_age,
                ownershipType: this.ownership_type,
                maintenanceCharges: this.maintenance_charges,
                facing: this.facing,
                parking: this.parking,
                gatedSecurity: this.gated_security,
                flooringType: this.flooring_type,
                nearbyLocation: this.nearby_location,
            },
            
            financials: {
                isNoBrokerage: this.is_no_brokerage,
                maxNegotiablePrice: this.max_negotiable_rent,
                negotiationMarginPercent: this.negotiation_margin_percent,
            },
            
            availability: {
                finalAvailableDate: this.final_available_date,
                currentOccupants: this.current_occupants,
            },

            preferences: {
                preferredGender: this.preferred_gender,
                preferredOccupation: this.preferred_occupation,
                preferredWorkLocation: this.preferred_work_location,
            },
            
            addressDetails: {
                // Granular Location Fields
                city: this.city,
                area: this.area,
                pincode: this.pincode,
                flatNumber: this.flat_number,
                stateName: this.state_name,
                districtName: this.districtName,
            },
            
            proximityPoints: {
                // Step 7 Fields
                transitPoints: this.transit_points,
                essentialPoints: this.essential_points,
                utilityPoints: this.utility_points,
            },

            systemInfo: {
                postedBy: this.postedBy,
                createdAt: this.createdAt,
                updatedAt: this.updatedAt,
                status: this.status,
                rating: this.rating
            }
        };
    }
}

module.exports = { FlatmateListingModel };