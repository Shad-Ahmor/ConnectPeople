// controllers/notificationController.js
const { db } = require('../config/firebaseConfig.js');
const { getFirebaseInstance } = require('../config/firebaseConfig.js');

exports.getUnreadCount = async (req, res) => {
  const uid = req.userId; // Middleware se lo
  const appName = req.appName || 'flatmate';
  const { db } = getFirebaseInstance(appName); 
  
  if (!uid) return res.status(401).json({ count: 0 });

  try {
    const rootNode = appName === 'flatmate' ? 'flatmate' : appName;
    const userRef = db.ref(`${rootNode}/users/${uid}`);
    
    // Ek hi baar mein poora user object fetch karein (Agar data bada na ho)
    // Ya fir selective fetch karein
    const userSnap = await userRef.once('value');
    const userData = userSnap.val() || {};
    
    let totalUnread = 0;

    const countUnread = (data) => {
      if (!data) return 0;
      return Object.values(data).filter(item => !item.isRead).length;
    };

    // 1. Visits count
    totalUnread += countUnread(userData.notifications?.visits);

    // 2. Offers count
    totalUnread += countUnread(userData.myOffers);

    // 3. Properties Reviews count (Loop through local data, no extra DB calls)
    const properties = userData.property || {};
    Object.values(properties).forEach(prop => {
      if (prop.reviews) {
        totalUnread += countUnread(prop.reviews);
      }
    });

    res.status(200).json({ count: totalUnread });
  } catch (error) {
    console.error("Unread count error:", error);
    res.status(500).json({ count: 0, error: error.message });
  }
};
/**
 * ✅ Get All Notifications for User
 */
exports.getUserNotifications = async (req, res) => {
  const uid = req.user?.uid || req.userId;
  const appName = req.appName || req.query.appName || 'flatmate';
  const { db } = getFirebaseInstance(appName);

  if (!uid) return res.status(401).json({ message: "User identity not found." });

  try {
    const rootNode = appName === 'flatmate' ? 'flatmate' : appName;
    
    
    // 1. Owner Profile fetch (Phone aur Properties ke liye)
    const userProfileSnapshot = await db.ref(`${rootNode}/users/${uid}`).once('value');
    const userProfile = userProfileSnapshot.val();
    const ownerPhone = userProfile?.phoneNumber || null;
    const userProperties = userProfile?.property || {};

    let combinedList = [];

    // --- Path 1: Visits ---
    const visitSnap = await db.ref(`${rootNode}/users/${uid}/notifications/visits`).once('value');
    if (visitSnap.exists()) {
      Object.entries(visitSnap.val()).forEach(([id, val]) => {
        combinedList.push({ 
          id, ...val, 
          type: 'visit', 
          visitorPhone: val.isInterestedLead ? ownerPhone : null, 
          node: 'notifications/visits' 
        });
      });
    }

    // --- Path 2: Offers ---
    const offerSnap = await db.ref(`${rootNode}/users/${uid}/myOffers`).once('value');
    if (offerSnap.exists()) {
      Object.entries(offerSnap.val()).forEach(([id, val]) => {
        combinedList.push({ id, ...val, type: 'offer', node: 'myOffers' });
      });
    }

    // --- Path 3: Reviews ---
    const propertyIds = Object.keys(userProperties);
    const reviewPromises = propertyIds.map(async (pid) => {
      const reviewsContainerSnap = await db.ref(`${rootNode}/users/${uid}/property/${pid}/reviews`).once('value');
      
      if (reviewsContainerSnap.exists()) {
        const allReviews = reviewsContainerSnap.val();
        Object.entries(allReviews).forEach(([reviewerUid, reviewData]) => {
          combinedList.push({ 
            id: `${pid}_${reviewerUid}`,
            ...reviewData, 
            type: 'review', 
            node: `property/${pid}/reviews/${reviewerUid}`, 
            propertyId: pid 
          });
        });
      }
    });

    await Promise.all(reviewPromises);
    combinedList.sort((a, b) => (b.timestamp || b.updatedAt || 0) - (a.timestamp || a.updatedAt || 0));

    return res.status(200).json({ notifications: combinedList });
    
  } catch (error) {
    console.error("Error in getUserNotifications:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

/**
 * ✅ Mark Single/All Notifications as Read
 * Optimized for: visits, myOffers, and property-specific reviews
 */
exports.markAsRead = async (req, res) => {
  const uid = req.user?.uid || req.userId;
  const appName = req.appName || req.body.appName || 'flatmate';
  const { db } = getFirebaseInstance(appName);
  
  const { notifId, node } = req.body; 

  try {
    if (!uid) return res.status(401).json({ message: "Unauthorized" });
    const rootNode = appName === 'flatmate' ? 'flatmate' : appName;

    if (notifId && node) {
      // CASE 1: Specific Notification
      await db.ref(`${rootNode}/users/${uid}/${node}/${notifId}`).update({ isRead: true });
    } else {
      // CASE 2: Mark ALL as read
      const userSnap = await db.ref(`${rootNode}/users/${uid}`).once('value');
      const properties = userSnap.val()?.property || {};
      
      const updatePromises = [];
      updatePromises.push(markNodeAsRead(db, `${rootNode}/users/${uid}/notifications/visits`));
      updatePromises.push(markNodeAsRead(db, `${rootNode}/users/${uid}/myOffers`));
      
      Object.keys(properties).forEach(pid => {
        updatePromises.push(markNodeAsRead(db, `${rootNode}/users/${uid}/property/${pid}/reviews`));
      });

      await Promise.all(updatePromises);
    }

    return res.status(200).json({ success: true, message: "Read status updated" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Update failed" });
  }
};

/**
 * Helper function jo kisi bhi node ke andar ke saare children ko isRead: true kar de
 */
async function markNodeAsRead(dbInstance, fullPath) {
  const ref = dbInstance.ref(fullPath);
  const snapshot = await ref.once('value');
  if (snapshot.exists()) {
    const data = snapshot.val();
    const updates = {};
    Object.keys(data).forEach(key => {
      if (typeof data[key] === 'object' && !data[key].isRead) {
        updates[`${key}/isRead`] = true;
      }
    });
    if (Object.keys(updates).length > 0) return ref.update(updates);
  }
  return Promise.resolve();
}