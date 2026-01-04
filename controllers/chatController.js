const { getFirebaseInstance } = require('../config/firebaseConfig.js');

const getRootNode = (appName) => {
    return appName === 'flatmate' ? 'flatmate' : appName;
};

exports.sendMessage = async (req, res) => {
    const senderId = req.user?.uid || req.userId;
    let { receiverId, propertyId, message, propertyLocation, clientMsgId } = req.body;
    if (!message || message.trim().length === 0) {
        return res.status(400).json({ message: "Message khali nahi ho sakta." });
    }
    if (message.length > 500) {
        return res.status(400).json({ message: "Message bohot lamba hai (Max 500 chars)." });
    }
    message = message.replace(/[<>]/g, ""); // <script> jaisi tags ko disable karne ke liye
    const appName = req.appName || req.body.appName || req.headers['x-app-name'] || 'flatmate';
    const { db } = getFirebaseInstance(appName);
    const rootNode = getRootNode(appName);

    if (!senderId || !receiverId || !message) {
        return res.status(400).json({ message: "Missing required fields" });
    }

   if (senderId.trim() === receiverId.trim()) {
        return res.status(400).json({ 
            success: false, 
            message: "Self-chat blocked. Check if receiverId is correct." 
        });
    }
    try {
        const chatId = [senderId, receiverId].sort().join('_') + `_${propertyId}`;
        const limitSnap = await db.ref(`${rootNode}/chats/${chatId}/limits/${senderId}`).once('value');
        const currentCount = limitSnap.val() || 0;

        if (currentCount >= 5) {
            return res.status(403).json({ 
                success: false, 
                limitExceeded: true,
                message: "Aap is chat mein 5 se zyada messages nahi bhej sakte." 
            });
        }

        const timestamp = Date.now();
        const currentBucketId = 1; 

        // --- BUCKET MODEL STRUCTURE (As per your Schema) ---
        // Hum bucket 1 ke andar "messages" array/node mein push kar rahe hain
        const messageRef = db.ref(`${rootNode}/messages/${chatId}/bucket_${currentBucketId}/messages`).push();
        
        const messageData = { senderId, text: message, timestamp ,status: 'sent', clientMsgId: clientMsgId || messageRef.key, repliedTo: req.body.repliedTo || null,
            repliedText: req.body.repliedText || null,
            repliedToSender: req.body.repliedToSender || null};

        // --- CHAT METADATA MODEL ---
        const chatSummary = {
            chatId: chatId,
            participants: [senderId, receiverId],
            propertyId: propertyId,
            lastMessage: {
                text: message,
                senderId: senderId,
                timestamp: timestamp
            },
            propertyLocation: propertyLocation || "Inquiry"
        };

        // --- MULTI-PATH UPDATE (Model Implementation) ---
        const updates = {};
        
       // A. Bucket Updates
        updates[`${rootNode}/messages/${chatId}/bucket_${currentBucketId}/messages/${messageRef.key}`] = messageData;
        updates[`${rootNode}/messages/${chatId}/bucket_${currentBucketId}/bucketId`] = currentBucketId;
        
        updates[`${rootNode}/messages/${chatId}/bucket_${currentBucketId}/chatId`] = chatId;

        // B. Metadata Update (Crucial for Chat List)
        updates[`${rootNode}/chats/${chatId}/metadata`] = chatSummary;
        updates[`${rootNode}/chats/${chatId}/lastSeen/${senderId}`] = timestamp;

        // C. Limits Update (For 5 message rule)
        updates[`${rootNode}/chats/${chatId}/limits/${senderId}`] = currentCount + 1;

        // D. User-Chat Mapping
        updates[`${rootNode}/users/${senderId}/myChats/${chatId}`] = true;
        updates[`${rootNode}/users/${receiverId}/myChats/${chatId}`] = true;

        await db.ref().update(updates);
        const remaining = 5 - (currentCount + 1);
        res.status(200).json({ success: true, chatId, messageData,remainingMessages: remaining ,tempId: clientMsgId});
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


exports.sendBulkMessages = async (req, res) => {
    const senderId = req.user?.uid || req.userId;
    
    const { receiverId, propertyId, messages, propertyLocation, appName: bodyAppName } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) return res.status(400).send("No messages");

    const appName = bodyAppName || 'flatmate';
    const { db } = getFirebaseInstance(appName);
    const rootNode = getRootNode(appName);
    const chatId = [senderId, receiverId].sort().join('_') + `_${propertyId}`;

    try {
        // 1. Current Limit Check
        const limitSnap = await db.ref(`${rootNode}/chats/${chatId}/limits/${senderId}`).once('value');
        let currentCount = limitSnap.val() || 0;

        if (currentCount >= 5) return res.status(403).json({ message: "Limit exceeded" });

        const updates = {};
        let processedCount = 0;
        const savedMessages = [];

        // 2. Loop through pending messages
        for (const msg of messages) {
            if (currentCount + processedCount >= 5) break; // Strict 5 limit check

            const msgRef = db.ref(`${rootNode}/messages/${chatId}/bucket_1/messages`).push();
            const timestamp = msg.timestamp || Date.now();
            
            const messageData = {
    senderId,
    text: msg.text.replace(/[<>]/g, "").slice(0, 500),
    timestamp,
    status: 'sent',
    clientMsgId: msg.clientMsgId || msgRef.key,
    repliedTo: msg.repliedTo || null,
    repliedText: msg.repliedText || null, 
    repliedToSender: msg.repliedToSender || null 
};
            updates[`${rootNode}/messages/${chatId}/bucket_1/messages/${msgRef.key}`] = messageData;
            savedMessages.push(messageData);
            processedCount++;
        }

        // 3. Metadata & Limit Updates
        if (processedCount > 0) {
            const lastMsg = savedMessages[savedMessages.length - 1];
            updates[`${rootNode}/chats/${chatId}/metadata/lastMessage`] = {
                text: lastMsg.text,
                senderId: senderId,
                timestamp: lastMsg.timestamp
            };
            updates[`${rootNode}/chats/${chatId}/limits/${senderId}`] = currentCount + processedCount;

                        // Metadata update ke saath ye bhi add karein
            updates[`${rootNode}/users/${senderId}/myChats/${chatId}`] = true;
            updates[`${rootNode}/users/${receiverId}/myChats/${chatId}`] = true;
            updates[`${rootNode}/chats/${chatId}/metadata/participants`] = [senderId, receiverId];
            updates[`${rootNode}/chats/${chatId}/metadata/propertyId`] = propertyId;
            updates[`${rootNode}/chats/${chatId}/metadata/propertyLocation`] = propertyLocation || "Inquiry";
            
            await db.ref().update(updates); // Ek baar mein saare messages save!
        }

        res.status(200).json({ 
            success: true, 
            remainingMessages: 5 - (currentCount + processedCount),
            processedIds: savedMessages.map(m => m.clientMsgId)
        });
    } catch (error) {
        res.status(500).json({ message: "Bulk send failed" });
    }
};

exports.getChatMessages = async (req, res) => {
    const { chatId } = req.params;
    const currentUserId = req.user?.uid || req.userId;
    if (!chatId.includes(currentUserId)) {
    return res.status(403).json({ message: "Access Denied: You are not part of this chat." });
}
    const appName = req.appName || req.query.appName || req.headers['x-app-name'] || 'flatmate';
    const { db } = getFirebaseInstance(appName);
    const rootNode = getRootNode(appName);
    const currentBucketId = 1; // Hamesha latest bucket fetch karein

    try {

        // Aapke bucket model ke path se data fetch ho raha hai
        await db.ref(`${rootNode}/chats/${chatId}/lastSeen/${currentUserId}`).set(Date.now());
        const messagesSnap = await db.ref(`${rootNode}/messages/${chatId}/bucket_${currentBucketId}/messages`)
                                   .limitToLast(100)
                                   .once('value');
        
        const messagesData = messagesSnap.val() || {};
        
        // UI ke liye array format aur sorting
        const messages = Object.keys(messagesData).map(key => ({
            id: key,
            ...messagesData[key],
            clientMsgId: messagesData[key].clientMsgId || key, 
            status: messagesData[key].status || 'sent' 
        })).sort((a, b) => b.timestamp - a.timestamp);

        // 3. Dusre user ki details (Phone & LastSeen for Blue Ticks)
        const ids = chatId.split('_');
        const otherUserId = ids[0] === currentUserId ? ids[1] : ids[0];
        
        // Parallel fetching for performance
        const [otherUserSnap, otherLastSeenSnap, limitSnap] = await Promise.all([
            db.ref(`${rootNode}/users/${otherUserId}`).once('value'),
            db.ref(`${rootNode}/chats/${chatId}/lastSeen/${otherUserId}`).once('value'),
            db.ref(`${rootNode}/chats/${chatId}/limits/${currentUserId}`).once('value')
        ]);
      
        const otherUser = otherUserSnap.val();
        const otherLastSeen = otherLastSeenSnap.val() || 0;
        const currentCount = limitSnap.val() || 0;
        const remaining = 5 - currentCount;
        res.status(200).json({ 
            success: true, 
            messages, 
            userId: currentUserId,
            remainingMessages: remaining < 0 ? 0 : remaining,
            chatId: chatId,
            phoneNumber: otherUser?.phoneNumber || receiverPhone || null,
            otherUserLastSeen: otherLastSeen // ✅ Yeh blue ticks ke liye zaroori hai
        });

     
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch messages" });
    }
};
exports.getUserChats = async (req, res) => {
    const uid = req.user?.uid || req.userId;
    const appName = req.appName || req.query.appName || req.headers['x-app-name'] || 'flatmate';
    const { db } = getFirebaseInstance(appName);
    const rootNode = getRootNode(appName);

    try {
        // 1. User ki chat list fetch karein
        const userChatsSnap = await db.ref(`${rootNode}/users/${uid}/myChats`).once('value');
        if (!userChatsSnap.exists()) return res.status(200).json({ success: true, chats: [] });

        const chatIds = Object.keys(userChatsSnap.val());

        // 2. Saari chats ka metadata ek saath fetch karein (Parallel fetching)
        const chatPromises = chatIds.map(async (id) => {
            // metadata path se basic info uthayein
            const snap = await db.ref(`${rootNode}/chats/${id}/metadata`).once('value');
            const data = snap.val();
            
            if (!data || !data.participants) return null;

            // Partner ID dhoondein
            const partnerId = data.participants.find(pId => String(pId).trim() !== String(uid).trim());
            
            if (!partnerId) return null;

            // Partner ki profile fetch karein
            const partnerSnap = await db.allRef ? null : await db.ref(`${rootNode}/users/${partnerId}`).once('value');
            const partnerData = partnerSnap?.val();
            
            // Unread status ke liye lastSeen comparison (Optional logic aap yahan add kar sakte hain)
            
            return {
                chatId: id, // Consistency ke liye chatId return karein
                ...data,
                partnerId,
                partnerName: partnerData?.displayName || partnerData?.name || "User",
                partnerPhoto: partnerData?.photoURL || partnerData?.profileImage || null,
                partnerPhone: partnerData?.phoneNumber || null
            };
        });

        const chats = (await Promise.all(chatPromises))
            .filter(c => c !== null)
            // Hamesha latest message upar dikhayein
            .sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));

        res.status(200).json({ success: true, chats });
    } catch (error) {
        console.error("getUserChats Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch chats" });
    }
};
exports.getChatStatus = async (req, res) => {
    const senderId = req.user?.uid || req.userId;
    const { propertyId } = req.params;
    const { ownerId } = req.query; // Property owner ki ID

    const appName = req.appName || req.query.appName || req.headers['x-app-name'] || 'flatmate';
    const { db } = getFirebaseInstance(appName);
    const rootNode = getRootNode(appName);

    if (!ownerId || !propertyId) {
        return res.status(400).json({ success: false, message: "Missing ownerId or propertyId" });
    }

    try {
        // Hamesha same pattern: sort keys -> join -> propertyId
        const chatId = [senderId, ownerId].sort().join('_') + `_${propertyId}`;
        
        // Metadata node check karein
        const chatSnap = await db.ref(`${rootNode}/chats/${chatId}/metadata`).once('value');

        if (chatSnap.exists()) {
            const chatData = chatSnap.val();
            return res.status(200).json({ 
                success: true, 
                chatExists: true,
                chat: {
                    chatId: chatId,
                    lastMessage: chatData.lastMessage?.text || "",
                    lastTimestamp: chatData.lastMessage?.timestamp || 0,
                    propertyLocation: chatData.propertyLocation || "Inquiry"
                }
            });
        }

        // Agar chat nahi mili
        res.status(200).json({ 
            success: true, 
            chatExists: false,
            suggestedChatId: chatId // Frontend ko pehle se ID de do
        });
    } catch (error) {
        console.error("getChatStatus Error:", error);
        res.status(500).json({ success: false, message: "Error checking chat status" });
    }
};