// flatmateListingModel.js - No functional change required here

class FlatmateListingModel {
    constructor(data) {
        // ------------------------------------
        // --- Core Validation (Existing & New) ---
        // ------------------------------------
        if (!data.location) throw new Error("Location is required for the listing.");
        if (!data.price) throw new Error("Price is required for the listing.");
        if (!data.listing_goal) throw new Error("Listing Goal is required (e.g., Rent, Sell).");
        if (!data.furnishing_status) throw new Error("Furnishing Status is required for the listing.");
        if (!data.deposit) throw new Error("Deposit amount is required.");

        // Price validation
        const parsedPrice = parseFloat(data.price);
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
            throw new Error("Price must be a valid positive number.");
        }

        // Deposit validation
        const parsedDeposit = parseFloat(data.deposit);
        if (isNaN(parsedDeposit) || parsedDeposit < 0) {
            throw new Error("Deposit must be a valid number.");
        }
        
        // Image validation (minimum 3 links)
        const validImageLinks = Array.isArray(data.imageLinks)
            ? data.imageLinks.filter(link => typeof link === 'string' && link.trim() !== '')
            : [];
        if (validImageLinks.length < 3) {
            throw new Error("At least 3 valid public image links are required.");
        }

        // ------------------------------------
        // --- Assign Core Fields ---
        // ------------------------------------
        this.location = data.location;
        this.price = parsedPrice;
        this.deposit = parsedDeposit; 
        this.listing_goal = data.listing_goal; // <--- The key field used for filtering
        this.imageLinks = validImageLinks;
        
        this.propertyType = data.type || data.propertyType || 'Apartment';
        
        this.description = data.description || '';
        this.bedrooms = parseInt(data.bedrooms) || 0;
        this.bathrooms = parseInt(data.bathrooms) || 0;
        this.carpetArea = parseInt(data.carpetArea) || 0; // 🆕 Added Carpet Area
        
        // ------------------------------------
        // --- Assign ALL Missing Fields ---
        // ------------------------------------
        this.furnishing_status = data.furnishing_status; 
        this.furnishing_details = data.furnishing_details || []; 
        this.final_available_date = data.final_available_date || 'Now'; 
        this.current_occupants = data.current_occupants || 0; 

        this.selectedAmenities = Array.isArray(data.selectedAmenities) ? data.selectedAmenities : []; 

        this.is_flatmate_listing = !!data.is_flatmate_listing; 
        this.is_no_brokerage = !!data.is_no_brokerage; 
        
        this.max_negotiable_price = data.max_negotiable_price || null; 
        this.negotiation_margin_percent = parseInt(data.negotiation_margin_percent) || 0; 
        
        this.preferred_gender = data.preferred_gender || 'Any'; 
        this.preferred_occupation = data.preferred_occupation || ''; 
        this.preferred_work_location = data.preferred_work_location || ''; 

        // ------------------------------------
        // --- System Fields ---
        // ------------------------------------
        this.postedBy = data.postedBy || null; 
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || this.createdAt; // 🆕 Added UpdatedAt
        this.status = data.status || 'Pending Review';
        this.rating = data.rating || (Math.floor(Math.random() * 20) / 10 + 3.0).toFixed(1); // Mock rating
    }

    // Helper to determine BHK or Room Count based on property type
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
            location: this.location,
            price: this.price,
            deposit: this.deposit, 
            listing_goal: this.listing_goal,
            imageLinks: this.imageLinks,
            description: this.description,
            bedrooms: this.bedrooms,
            bathrooms: this.bathrooms,
            propertyType: this.propertyType,
            carpetArea: this.carpetArea, 
            
            furnishing_status: this.furnishing_status,
            final_available_date: this.final_available_date,
            current_occupants: this.current_occupants,
            selectedAmenities: this.selectedAmenities,
            is_flatmate_listing: this.is_flatmate_listing,
            is_no_brokerage: this.is_no_brokerage,
            max_negotiable_price: this.max_negotiable_price,
            negotiation_margin_percent: this.negotiation_margin_percent,
            preferred_gender: this.preferred_gender,
            preferred_occupation: this.preferred_occupation,
            preferred_work_location: this.preferred_work_location,
            
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
            price: this.price,
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
            price: data.price,
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
            price: this.price,
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
            },
            
            financials: {
                isNoBrokerage: this.is_no_brokerage,
                maxNegotiablePrice: this.max_negotiable_price,
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