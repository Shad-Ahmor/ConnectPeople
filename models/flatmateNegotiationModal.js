class NegotiationModel {
    constructor(data) {
        // --- 1. Validation: Ye fields hona mandatory hai ---
        if (!data.listingId) throw new Error("Listing ID is required for negotiation.");
        if (!data.ownerId) throw new Error("Owner ID is required for negotiation.");
        if (!data.visitorId) throw new Error("Visitor ID is required for negotiation.");

        // --- 2. Core Fields ---
        this.listingId = data.listingId;
        this.visitorId = data.visitorId;
        this.ownerId = data.ownerId;
        
        // Amount logic: Ensure it's always a number
        this.offerAmount = Number(data.offerAmount) || 0;
        this.originalRent = Number(data.originalRent) || 0;
        
        // Status logic
        const validStatuses = ['pending', 'accepted', 'rejected', 'countered'];
        this.status = validStatuses.includes(data.status) ? data.status : 'pending';

        // Visitor Info
        this.visitorName = data.visitorName || "Interested User";
        this.visitorPhoto = data.visitorPhoto || "";

        // --- 3. Metadata ---
        // Agar data backend se aa raha hai toh timestamp hoga, 
        // agar hum naya bana rahe hain toh updated field empty rahegi (Controller handle karega)
        this.updatedAt = data.updatedAt || null; 
    }

    // Database mein save karne ke liye (Aapke deep-nested structure ke liye optimized)
    toDatabaseFormat(serverTimestamp) {
        return {
            listingId: this.listingId,
            visitorId: this.visitorId,
            ownerId: this.ownerId,
            offerAmount: this.offerAmount,
            originalRent: this.originalRent,
            status: this.status,
            visitorName: this.visitorName,
            visitorPhoto: this.visitorPhoto,
            updatedAt: serverTimestamp || Date.now() // Use provided timestamp or current
        };
    }

    // Frontend ko bhejne ke liye clean data
    toFrontendFormat() {
        // Calculate discount percentage safely
        let discountPercent = "0%";
        if (this.originalRent > 0 && this.offerAmount > 0) {
            const diff = this.originalRent - this.offerAmount;
            discountPercent = ((diff / this.originalRent) * 100).toFixed(1) + '%';
        }

        return {
            ...this.toDatabaseFormat(this.updatedAt),
            // Extra: Hum calculation karke bhej sakte hain kitna % kam offer kiya hai
            discountPercent: discountPercent
        };
    }
}

module.exports = NegotiationModel;