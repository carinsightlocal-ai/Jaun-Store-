// Jaun Store - Firebase Backend Service Layer
// Project: jaun-d2612
// Admin: rahankahan51214786@gmail.com

import {
  db,
  auth,
  analytics,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  increment,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  logEvent
} from './firebase-config.js';

export const ADMIN_EMAIL = "rahankahan51214786@gmail.com";
export const ADMIN_PASS = "John@12!";

class FirebaseBackendService {
  constructor() {
    this.isOnline = false;
    this.currentUser = null;
    this.connectionListeners = [];
    this.authListeners = [];
    this.toolsCache = [];

    // Check cached session
    this.restoreLocalSession();
  }

  restoreLocalSession() {
    try {
      const saved = localStorage.getItem('jaun_vip_session');
      if (saved) {
        this.currentUser = JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Could not restore session:", e);
    }
  }

  saveLocalSession(user) {
    this.currentUser = user;
    try {
      if (user) {
        localStorage.setItem('jaun_vip_session', JSON.stringify(user));
      } else {
        localStorage.removeItem('jaun_vip_session');
      }
    } catch (e) {
      console.warn("Could not persist session:", e);
    }
    this.notifyAuthListeners();
  }

  onAuthChange(callback) {
    this.authListeners.push(callback);
    callback(this.getCurrentUser());
  }

  notifyAuthListeners() {
    const user = this.getCurrentUser();
    this.authListeners.forEach(cb => {
      try { cb(user); } catch (e) { console.error(e); }
    });
  }

  getCurrentUser() {
    if (this.currentUser) {
      const isAdmin = (this.currentUser.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
      return {
        ...this.currentUser,
        isAdmin
      };
    }
    return null;
  }

  isAdmin() {
    const u = this.getCurrentUser();
    return !!(u && u.isAdmin);
  }

  // Initialize Backend & Auth state listener
  async init() {
    try {
      onAuthStateChanged(auth, (fbUser) => {
        if (fbUser && fbUser.email) {
          const isAdmin = fbUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
          const userObj = {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName || (isAdmin ? 'Jaun Khan (Admin)' : 'VIP Member'),
            isAdmin
          };
          this.saveLocalSession(userObj);
          this.setConnected(true);
        } else if (!this.currentUser || !this.currentUser.email) {
          // If no email user is logged in, use anonymous auth for public counter tracking
          signInAnonymously(auth).catch((err) => {
            // Anonymous auth fallback
          });
        }
      });

      this.setConnected(true);
      return true;
    } catch (err) {
      console.warn("⚠️ Firebase connection in fallback mode:", err);
      this.setConnected(false);
      return false;
    }
  }

  // User Login (Supports Firebase Auth & Admin Credentials Fallback)
  async loginUser(email, password) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    const isAdminCredential = 
      cleanEmail === ADMIN_EMAIL.toLowerCase() && 
      cleanPass === ADMIN_PASS;

    try {
      // 1. Attempt official Firebase Email/Password Sign-In
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
      const user = cred.user;
      const isAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      const userObj = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || (isAdmin ? 'Jaun Khan (Admin)' : 'VIP Member'),
        isAdmin
      };
      this.saveLocalSession(userObj);
      return { success: true, user: userObj };
    } catch (err) {
      console.warn("Firebase sign-in note:", err.message);

      // 2. If it's the official Admin credentials, guarantee immediate login even if Email/Password provider isn't enabled in console
      if (isAdminCredential) {
        console.log("👑 VIP Admin Authenticated via Master Credentials");
        const adminUser = {
          uid: 'admin-jaun-master',
          email: ADMIN_EMAIL,
          displayName: 'Jaun Khan (Admin)',
          isAdmin: true
        };
        this.saveLocalSession(adminUser);
        return { success: true, user: adminUser };
      }

      // Check if user was registered locally in mock/demo
      const localUsers = JSON.parse(localStorage.getItem('jaun_registered_users') || '[]');
      const found = localUsers.find(u => u.email.toLowerCase() === cleanEmail && u.password === cleanPass);
      if (found) {
        const memberUser = {
          uid: found.uid || `user-${Date.now()}`,
          email: found.email,
          displayName: found.displayName || 'VIP Member',
          isAdmin: false
        };
        this.saveLocalSession(memberUser);
        return { success: true, user: memberUser };
      }

      throw new Error(err.message || 'Invalid email or password.');
    }
  }

  // User Registration
  async registerUser(name, email, password) {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    try {
      // 1. Attempt Firebase Auth Account Creation
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
      if (cleanName) {
        await updateProfile(cred.user, { displayName: cleanName });
      }
      const userObj = {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cleanName || 'VIP Member',
        isAdmin: cleanEmail === ADMIN_EMAIL.toLowerCase()
      };
      this.saveLocalSession(userObj);
      return { success: true, user: userObj };
    } catch (err) {
      console.warn("Firebase createUser note:", err.message);

      // Fallback local registration if Firebase email auth is not toggled on
      const localUsers = JSON.parse(localStorage.getItem('jaun_registered_users') || '[]');
      if (localUsers.some(u => u.email.toLowerCase() === cleanEmail)) {
        throw new Error("This email is already registered.");
      }

      const newUser = {
        uid: `user-${Date.now()}`,
        email: cleanEmail,
        displayName: cleanName || 'VIP Member',
        password: cleanPass
      };
      localUsers.push(newUser);
      localStorage.setItem('jaun_registered_users', JSON.stringify(localUsers));

      const userObj = {
        uid: newUser.uid,
        email: newUser.email,
        displayName: newUser.displayName,
        isAdmin: cleanEmail === ADMIN_EMAIL.toLowerCase()
      };
      this.saveLocalSession(userObj);
      return { success: true, user: userObj };
    }
  }

  // User Sign Out
  async logoutUser() {
    try {
      await signOut(auth);
    } catch (e) {
      // Continue
    }
    this.saveLocalSession(null);
    return true;
  }

  onConnectionChange(callback) {
    this.connectionListeners.push(callback);
    callback(this.isOnline);
  }

  setConnected(status) {
    this.isOnline = status;
    this.connectionListeners.forEach(cb => {
      try { cb(status); } catch (e) { console.error(e); }
    });
  }

  // Fetch Tools: First from Firestore, fallback to local store-data.js
  async getTools(localFallbackData = []) {
    try {
      const toolsCol = collection(db, "tools");
      const snapshot = await getDocs(toolsCol);

      if (snapshot.empty) {
        console.log("ℹ️ Firestore 'tools' collection is empty. Utilizing local VIP catalog.");
        this.toolsCache = [...localFallbackData];
        await this.enrichToolsWithStats(this.toolsCache);
        return this.toolsCache;
      }

      const cloudTools = [];
      snapshot.forEach(docSnap => {
        cloudTools.push({ id: docSnap.id, ...docSnap.data() });
      });

      this.toolsCache = cloudTools;
      await this.enrichToolsWithStats(this.toolsCache);
      return this.toolsCache;
    } catch (err) {
      console.warn("⚠️ Utilizing offline catalog:", err.message);
      this.toolsCache = [...localFallbackData];
      return this.toolsCache;
    }
  }

  // Enrich tools with dynamic download/click counters
  async enrichToolsWithStats(tools) {
    try {
      const statsCol = collection(db, "analytics");
      const statsSnap = await getDocs(statsCol);
      const statsMap = {};
      statsSnap.forEach(d => {
        statsMap[d.id] = d.data();
      });

      tools.forEach(tool => {
        if (statsMap[tool.id]) {
          const s = statsMap[tool.id];
          tool.liveDownloads = s.downloads || 0;
          tool.liveClicks = s.clicks || 0;
          tool.liveWhatsAppOrders = s.whatsappOrders || 0;
          tool.liveViews = s.views || 0;
        }
      });
    } catch (e) {
      // Continue
    }
  }

  // Real-time listener for tools catalog
  listenToTools(callback, localFallback = []) {
    try {
      const toolsCol = collection(db, "tools");
      const unsub = onSnapshot(toolsCol, async (snapshot) => {
        if (!snapshot.empty) {
          const list = [];
          snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
          this.toolsCache = list;
          await this.enrichToolsWithStats(this.toolsCache);
          callback(this.toolsCache);
        } else {
          callback(localFallback);
        }
      }, (err) => {
        callback(localFallback);
      });
      return unsub;
    } catch (err) {
      callback(localFallback);
      return () => {};
    }
  }

  // Seed default tools catalog into Firestore
  async seedCatalog(tools) {
    let successCount = 0;
    try {
      for (const tool of tools) {
        const docRef = doc(db, "tools", tool.id);
        await setDoc(docRef, {
          ...tool,
          updatedAt: serverTimestamp()
        }, { merge: true });
        successCount++;
      }
      return { success: true, count: successCount };
    } catch (err) {
      console.error("Error seeding catalog:", err);
      throw err;
    }
  }

  // Add or Edit a single tool in Firestore
  async saveTool(toolData) {
    try {
      const toolId = toolData.id || `tool-${Date.now()}`;
      const docRef = doc(db, "tools", toolId);
      await setDoc(docRef, {
        ...toolData,
        id: toolId,
        updatedAt: serverTimestamp()
      }, { merge: true });
      return { success: true, id: toolId };
    } catch (err) {
      console.error("Error saving tool:", err);
      throw err;
    }
  }

  // Delete a tool from Firestore (Admin only)
  async deleteTool(toolId) {
    try {
      const docRef = doc(db, "tools", toolId);
      await deleteDoc(docRef);
      console.log(`🗑️ Tool deleted from Firestore: ${toolId}`);
      return { success: true };
    } catch (err) {
      console.error("Error deleting tool:", err);
      throw err;
    }
  }

  // Record an action (download, whatsapp click, advance booking, webapp launch, view)
  async recordAction(toolId, actionType, meta = {}) {
    try {
      const analyticsDoc = doc(db, "analytics", toolId);
      const updatePayload = {
        lastActivity: serverTimestamp(),
        totalInteractions: increment(1)
      };

      if (actionType === 'download') {
        updatePayload.downloads = increment(1);
      } else if (actionType === 'whatsapp_order' || actionType === 'advance_booking') {
        updatePayload.whatsappOrders = increment(1);
      } else if (actionType === 'open_web_app') {
        updatePayload.webAppLaunches = increment(1);
      } else if (actionType === 'view') {
        updatePayload.views = increment(1);
      } else {
        updatePayload.clicks = increment(1);
      }

      await setDoc(analyticsDoc, updatePayload, { merge: true });

      // Log event
      const eventsCol = collection(db, "event_logs");
      await addDoc(eventsCol, {
        toolId,
        actionType,
        meta,
        userId: this.currentUser ? this.currentUser.uid : 'guest',
        userEmail: this.currentUser ? this.currentUser.email : 'guest',
        timestamp: serverTimestamp(),
        userAgent: navigator.userAgent
      });

      if (analytics) {
        logEvent(analytics, actionType, { tool_id: toolId, ...meta });
      }

      return true;
    } catch (err) {
      return false;
    }
  }

  // Submit User Review for a Tool
  async submitReview(toolId, { author, rating, comment, role = 'Verified VIP User' }) {
    try {
      const reviewsCol = collection(db, "reviews");
      const user = this.getCurrentUser();
      const newReview = {
        toolId,
        author: (author || (user ? user.displayName : '')).trim() || 'Anonymous VIP User',
        rating: Number(rating) || 5,
        comment: comment.trim(),
        role: user && user.isAdmin ? 'Admin & Founder' : role.trim(),
        userId: user ? user.uid : 'guest',
        userEmail: user ? user.email : '',
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(reviewsCol, newReview);
      return { success: true, id: docRef.id };
    } catch (err) {
      console.error("Error submitting review:", err);
      throw err;
    }
  }

  // Real-time listener for Reviews on a specific Tool
  listenToReviews(toolId, callback) {
    try {
      const reviewsCol = collection(db, "reviews");
      const q = query(reviewsCol, limit(50));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const reviews = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.toolId === toolId) {
            reviews.push({ id: docSnap.id, ...data });
          }
        });
        
        reviews.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.timestamp || 0);
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.timestamp || 0);
          return timeB - timeA;
        });

        callback(reviews);
      }, (err) => {
        callback([]);
      });

      return unsubscribe;
    } catch (err) {
      callback([]);
      return () => {};
    }
  }

  // Create an Online Order
  async createOnlineOrder(orderData) {
    try {
      const ordersCol = collection(db, "orders");
      const orderId = `ORD-${Date.now().toString().slice(-6)}`;
      const payload = {
        ...orderData,
        orderId,
        status: 'pending',
        createdAt: serverTimestamp(),
        userId: this.currentUser ? this.currentUser.uid : 'guest',
        userEmail: this.currentUser ? this.currentUser.email : (orderData.customerEmail || '')
      };

      const docRef = await addDoc(ordersCol, payload);

      // Track order in analytics
      if (orderData.toolId) {
        await this.recordAction(orderData.toolId, 'online_order', {
          orderId,
          amount: orderData.price,
          method: orderData.paymentMethod
        });
      }

      // Also persist locally
      const localOrders = JSON.parse(localStorage.getItem('jaun_my_orders') || '[]');
      localOrders.unshift({ id: docRef.id, ...payload, createdAt: Date.now() });
      localStorage.setItem('jaun_my_orders', JSON.stringify(localOrders));

      return { success: true, id: docRef.id, orderId };
    } catch (err) {
      console.error("Error creating online order:", err);
      const orderId = `ORD-${Date.now().toString().slice(-6)}`;
      const localOrders = JSON.parse(localStorage.getItem('jaun_my_orders') || '[]');
      const localPayload = { ...orderData, orderId, status: 'pending', createdAt: Date.now() };
      localOrders.unshift(localPayload);
      localStorage.setItem('jaun_my_orders', JSON.stringify(localOrders));
      return { success: true, id: orderId, orderId };
    }
  }

  // Real-time listener for all orders (Admin Panel)
  listenToOrders(callback) {
    try {
      const ordersCol = collection(db, "orders");
      const q = query(ordersCol, limit(100));
      return onSnapshot(q, (snapshot) => {
        const orders = [];
        snapshot.forEach(docSnap => {
          orders.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Merge with local orders so no orders are ever lost or delayed
        const local = JSON.parse(localStorage.getItem('jaun_my_orders') || '[]');
        local.forEach(lo => {
          if (!orders.some(o => o.orderId === lo.orderId || o.id === lo.id)) {
            orders.push(lo);
          }
        });

        orders.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.timestamp || a.createdAt || 0);
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.timestamp || b.createdAt || 0);
          return timeB - timeA;
        });
        callback(orders);
      }, (err) => {
        console.warn("Firestore orders listener fallback:", err.message);
        const local = JSON.parse(localStorage.getItem('jaun_my_orders') || '[]');
        callback(local);
      });
    } catch (e) {
      const local = JSON.parse(localStorage.getItem('jaun_my_orders') || '[]');
      callback(local);
      return () => {};
    }
  }

  // Update order status (Admin Panel)
  async updateOrderStatus(orderDocId, newStatus) {
    try {
      const orderDoc = doc(db, "orders", orderDocId);
      await updateDoc(orderDoc, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (err) {
      console.error("Error updating order status:", err);
      throw err;
    }
  }

  // Fetch Dashboard Stats for Admin Panel
  async getDashboardStats() {
    const stats = {
      totalTools: this.toolsCache.length || 5,
      totalDownloads: 0,
      totalWhatsAppOrders: 0,
      totalOnlineOrders: 0,
      totalViews: 0,
      totalReviews: 0,
      recentEvents: []
    };

    try {
      // 1. Sum up analytics
      const statsCol = collection(db, "analytics");
      const statsSnap = await getDocs(statsCol);
      statsSnap.forEach(d => {
        const data = d.data();
        stats.totalDownloads += (data.downloads || 0);
        stats.totalWhatsAppOrders += (data.whatsappOrders || 0);
        stats.totalViews += (data.views || 0);
      });

      // 2. Count reviews
      const reviewsCol = collection(db, "reviews");
      const revSnap = await getDocs(reviewsCol);
      stats.totalReviews = revSnap.size;

      // 3. Count online orders
      const ordersCol = collection(db, "orders");
      const ordSnap = await getDocs(ordersCol);
      stats.totalOnlineOrders = ordSnap.size;

      // 4. Recent events
      const eventsCol = collection(db, "event_logs");
      const eventsSnap = await getDocs(eventsCol);
      const events = [];
      eventsSnap.forEach(d => events.push({ id: d.id, ...d.data() }));
      events.sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        return timeB - timeA;
      });
      stats.recentEvents = events.slice(0, 15);
    } catch (e) {
      console.warn("Notice loading dashboard stats:", e.message);
    }

    return stats;
  }
}

// Global Singleton Instance
export const backend = new FirebaseBackendService();
window.JaunFirebaseBackend = backend;
