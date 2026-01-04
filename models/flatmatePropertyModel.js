// src/models/FlatmatePropertyModel.js
// 
// 💡 NOTE: यह फ़ाइल अब Node.js (CommonJS) के बजाय ES Module (import/export) का उपयोग करती है।

class FlatmatePropertyModel {
    // Unique Fields for Completeness (Total: 35 Fields)
static UNIQUE_DATA_FIELDS = [
    'area',
'bedrooms',
 'bathrooms',
 'building_age', 
  'current_occupants', 
   'city',
 'deposit', 
 'description', 
 'districtName',
   'essential_points',
     'furnishing_status',
      'furnishing_details', 
      'final_available_date',
      'flat_number',
      'facing', 
       'flooring_type',
 'gated_security',  
 'imageLinks',
 'is_no_brokerage', 
    'location',  
    'listing_goal',
     'maintenance_charges',
     'max_negotiable_rent', 
     'negotiation_margin_percent',    
      'nearby_location',
     'ownership_type',
      'parking', 
       'propertyType', 
       'preferred_gender', 
       'preferred_occupation', 
       'preferred_work_location', 
     'pincode',  
     'rent',
     'selectedAmenities',
      'state_name', 
     'transit_points' ,
        'utility_points', 
    

];




    constructor(data) {
    if (!data) throw new Error("No data provided to Listing Model");

    // 💡 IMPROVED HELPER: Check multiple possible keys for a value
    const getVal = (keys) => {
        for (let key of keys) {
            if (data[key] !== undefined && data[key] !== null) return data[key];
        }
        return null;
    };

    // ------------------------------------
    // --- Core Validation (Update-Safe) ---
    // ------------------------------------

    // 1. Location Validation
    this.location = data.location || "";
    if (!this.location) throw new Error("Location is required for the listing.");

    // 2. Rent/Price Validation (Error yahan aa raha tha)
    // Check both 'rent' (DB) and 'price' (Model logic)
    const rawPrice = getVal(['rent', 'price']);
    if (rawPrice === null || rawPrice === undefined) {
        throw new Error("Price is required for the listing (Price/Rent field missing).");
    }
    this.rent = parseFloat(rawPrice);
    if (isNaN(this.rent) || this.rent <= 0) {
        throw new Error("Price must be a valid positive number.");
    }

    // 3. Listing Goal
    this.listing_goal = data.listing_goal;
    if (!this.listing_goal) throw new Error("Listing Goal is required.");

    // 4. Furnishing Status
    this.furnishing_status = getVal(['furnishing_status', 'furnishing_type']);
    if (!this.furnishing_status) throw new Error("Furnishing Status is required.");

    // 5. Deposit
    const rawDeposit = getVal(['deposit', 'security_deposit']);
    if (rawDeposit === null) throw new Error("Deposit amount is required.");
    this.deposit = parseFloat(rawDeposit);
    if (isNaN(this.deposit)) throw new Error("Deposit must be a valid number.");

    // 6. Image Links Validation
    const rawImageLinks = getVal(['imageLinks', 'image_links']);
    const validImageLinks = Array.isArray(rawImageLinks)
        ? rawImageLinks.filter(link => typeof link === 'string' && link.trim() !== '')
        : [];
    if (validImageLinks.length < 1) {
        throw new Error("At least 1 valid public image link is required.");
    }
    this.imageLinks = validImageLinks;

    // ------------------------------------
    // --- Assignment (Handling Mappings) ---
    // ------------------------------------
    
    // Property Type
    this.propertyType = data.propertyType || data.property_type || 'Apartment';
    this.description = data.description || '';
    
    // Bedrooms logic
    let parsedBedrooms = parseInt(data.bedrooms) || 0;
    if (isNaN(parsedBedrooms) && typeof data.bedrooms === 'string') {
         const match = data.bedrooms.match(/\d+/); 
         if (match) parsedBedrooms = parseInt(match[0]);
    }
    this.bedrooms = parsedBedrooms;
    this.bathrooms = parseInt(data.bathrooms) || 0;
    this.carpetArea = parseInt(data.carpetArea) || 0;

    // Furnishing details
    this.furnishing_details = data.furnishing_details || []; 
    
    // Dates & Occupants
    this.final_available_date = data.final_available_date || data.available_date || 'Now'; 
    this.current_occupants = parseInt(data.current_occupants) || 0; 

    // Amenities
    this.selectedAmenities = Array.isArray(data.selectedAmenities || data.amenities) 
                             ? (data.selectedAmenities || data.amenities) : []; 

    // Brokerage & Negotiation
    this.is_flatmate_listing = (this.listing_goal === 'Flatmate'); 
    this.is_no_brokerage = !!(data.is_no_brokerage || data.is_brokerage_free); 
    this.max_negotiable_rent = parseFloat(data.max_negotiable_rent) || null; 
    this.negotiation_margin_percent = parseInt(data.negotiation_margin_percent || data.negotiation_margin) || 0; 
    
        // Preferences
    this.preferred_gender = data.preferred_gender || 'Any'; 
    this.preferred_occupation = data.preferred_occupation || 'Any';
    this.preferred_work_location = data.preferred_work_location || ''; 

    // Address Details
    this.city = data.city || null;
    this.area = data.area || null;
    this.pincode = data.pincode || null;
    this.flat_number = data.flat_number || null;
    this.state_name = data.state_name || null;
    this.districtName = data.districtName || null;
    
    // Building Details
    this.building_age = parseInt(data.building_age) || 0;
    this.ownership_type = data.ownership_type || null;
    this.maintenance_charges = parseFloat(data.maintenance_charges) || 0;
    this.facing = data.facing || null;
    this.parking = data.parking || null;
    this.gated_security = data.gated_security === undefined ? true : !!data.gated_security;
    this.flooring_type = Array.isArray(data.flooring_type) ? data.flooring_type : [];
    this.nearby_location = data.nearby_location || null;

    // Points of interest
    this.transit_points = Array.isArray(data.transit_points) ? data.transit_points : [];
    this.essential_points = Array.isArray(data.essential_points) ? data.essential_points : [];
    this.utility_points = Array.isArray(data.utility_points) ? data.utility_points : [];

    // System Fields
    this.postedBy = data.postedBy || null; 
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || this.createdAt; 
    this.status = data.status || 'Pending Review';
    this.rating = data.rating ? String(data.rating) : "4.0";
}


   static calculateCompletion(data) {
    if (!data) return { percentage: 0, isCompleted: false, label: "0% Detailed" };

    let filledCount = 0;
    // 🚀 FIX: Static variable ko Class name se access karein
    const fields = FlatmatePropertyModel.UNIQUE_DATA_FIELDS; 
    const totalFields = fields.length;

    fields.forEach(field => {
    const value = data[field];
    
    // 1. Pehle basic null/undefined/empty string check
    if (value !== undefined && value !== null && value !== '') {
        
        // 2. Agar Array hai toh length check karo
        if (Array.isArray(value)) {
            if (value.length > 0) filledCount++;
        } 
        // 3. Agar Boolean hai toh count karo (chahe true ho ya false, field toh bhari hai)
        else if (typeof value === 'boolean') {
            filledCount++;
        }
        // 4. Agar Number hai toh count karo
        else if (typeof value === 'number') {
            filledCount++;
        }
        // 5. Agar String hai toh trim karke check karo
        else if (typeof value === 'string' && value.trim() !== '') {
            filledCount++;
        }
    }
});

    const percentage = Math.round((filledCount / totalFields) * 100);
    return {
        percentage: percentage || 0,
        isCompleted: percentage === 100,
        label: percentage === 100 ? "100% Completed" : `${percentage}% Detailed`
    };
}

    // Helper to determine BHK or Room Count based on property type
    getBhkOrRooms() {
        if (this.propertyType === 'Flat' || this.propertyType === 'Shared Flatmate' || this.propertyType.includes('BHK')) {
            // यदि bedrooms 0 है, तो इसे RK (Room Kitchen) मानें, अन्यथा BHK
            return this.bedrooms > 0 ? `${this.bedrooms} BHK` : 'RK'; 
        } else {
            return `${this.bedrooms} Bedrooms`; 
        }
    }


    toRTDBData(userId) {
        // Data structure for saving to Realtime Database
        this.postedBy = userId;
        return {
            location: this.location,
            rent: this.rent, 
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
            max_negotiable_rent: this.max_negotiable_rent,
            negotiation_margin_percent: this.negotiation_margin_percent,
            preferred_gender: this.preferred_gender,
            preferred_occupation: this.preferred_occupation,
            preferred_work_location: this.preferred_work_location,
            
            // Granular Location & Property Details
            city: this.city,
            area: this.area,
            pincode: this.pincode,
            flat_number: this.flat_number,
            state_name: this.state_name,
            districtName: this.districtName,
            building_age: this.building_age,
            ownership_type: this.ownership_type,
            maintenance_charges: this.maintenance_charges,
            facing: this.facing,
            parking: this.parking,
            gated_security: this.gated_security,
            flooring_type: this.flooring_type,
            nearby_location: this.nearby_location,

            // Proximity POI
            transit_points: this.transit_points,
            essential_points: this.essential_points,
            utility_points: this.utility_points,
            
            // System Fields
            postedBy: this.postedBy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            status: this.status,
            rating: this.rating
        };
    }

    // Minimal data for post response
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
    

    // API 1 (Limited Details) for public/user list view
   static toLimitedFrontendData(data, listingId, userId) {
        if (!data) return null;

        return {
            id: listingId,
            ownerId: userId,
            title: data.title || `${data.bedrooms || ''} BHK in ${data.area || ''}`,
            rent: Number(data.rent) || 0,
            deposit: Number(data.deposit) || 0,
            area: data.area || "N/A",
            city: data.city || "N/A",
            bedrooms: data.bedrooms || 0,
            bathrooms: data.bathrooms || 0,
            furnishing_status: data.furnishing_status || "Unfurnished",
            propertyType: data.propertyType || "flat",
            listing_goal: data.listing_goal || "rent",
            image: (data.image_links && data.image_links[0]) || (data.imageLinks && data.imageLinks[0]) || null,
            rating: data.rating || "0.0",
            status: data.status || "pending review",
            createdAt: data.createdAt || new Date().toISOString()
        };
    }

    // API 2 & 4 (Complete Details) for single view/update response
    toFrontendFullData(listingId) {
        return {
            listingId,
            location: this.location,
            rent: this.rent,
            deposit: this.deposit,
            listingGoal: this.listing_goal,
            description: this.description,
            imageLinks: this.imageLinks, 
            
            propertyDetails: {
                propertyType: this.propertyType,
                bedrooms: this.bedrooms,
                bathrooms: this.bathrooms,
                bhkOrRooms: this.getBhkOrRooms(),
                totalCarpetAreaSqft: this.carpetArea || 'N/A',
                furnishingStatus: this.furnishing_status,
                furnishingDetails: this.furnishing_details,
                selectedAmenities: this.selectedAmenities,
                
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
                city: this.city,
                area: this.area,
                pincode: this.pincode,
                flatNumber: this.flat_number,
                stateName: this.state_name,
                districtName: this.districtName,
            },
            
            proximityPoints: {
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

// ES Module export
module.exports = FlatmatePropertyModel;