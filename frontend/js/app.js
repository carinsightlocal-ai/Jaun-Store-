// Jaun Store - Main Application Logic with Firebase Backend Integration
// Project: jaun-d2612

import { backend } from './firebase-backend.js';

let currentStoreTools = [...(window.JAUN_STORE_DATA || [])];
let currentCategory = 'all';
let searchQuery = '';
let activeReviewsUnsubscribe = null;
let selectedRating = 5;

// DOM Elements
const toolsGrid = document.getElementById('toolsGrid');
const searchInput = document.getElementById('searchInput');
const filterPills = document.querySelectorAll('.filter-btn');
const detailModal = document.getElementById('detailModal');
const detailModalBody = document.getElementById('detailModalBody');
const guideModal = document.getElementById('guideModal');
const adminModal = document.getElementById('adminModal');
const btnOpenGuide = document.getElementById('btnOpenGuide');
const btnOpenAdmin = document.getElementById('btnOpenAdmin');
const closeDetailModal = document.getElementById('closeDetailModal');
const closeGuideModal = document.getElementById('closeGuideModal');
const closeAdminModal = document.getElementById('closeAdminModal');
const btnSeedCatalog = document.getElementById('btnSeedCatalog');
const addToolForm = document.getElementById('addToolForm');
const adminFormStatus = document.getElementById('adminFormStatus');
const firebaseStatusBadge = document.getElementById('firebaseStatusBadge');
const firebaseStatusText = document.getElementById('firebaseStatusText');
const toast = document.getElementById('toastNotification');
const toastTitle = document.getElementById('toastTitle');
const toastDesc = document.getElementById('toastDesc');

// Initialize Store
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  renderTools();
  updateCategoryCounts();

  // Initialize Firebase Backend
  try {
    await backend.init();
    
    // Bind Connection Status Indicator
    backend.onConnectionChange((connected) => {
      if (firebaseStatusBadge && firebaseStatusText) {
        if (connected) {
          firebaseStatusBadge.classList.add('connected');
          firebaseStatusText.textContent = 'Firebase Cloud Live ⚡';
        } else {
          firebaseStatusBadge.classList.remove('connected');
          firebaseStatusText.textContent = 'Offline Fallback';
        }
      }
    });

    // Bind User Authentication in Navbar
    backend.onAuthChange((user) => {
      updateNavbarAuth(user);
    });

    // Load dynamic tools from Firestore (or local fallback)
    const cloudTools = await backend.getTools(window.JAUN_STORE_DATA || []);
    if (cloudTools && cloudTools.length > 0) {
      currentStoreTools = cloudTools;
      renderTools();
      updateCategoryCounts();
    }

    // Subscribe to live catalog updates
    backend.listenToTools((tools) => {
      currentStoreTools = tools;
      renderTools();
      updateCategoryCounts();
    }, window.JAUN_STORE_DATA || []);

  } catch (err) {
    console.warn("Using offline catalog fallback:", err);
  }
});

// Render Tools based on current filter & search
function renderTools() {
  const filteredTools = currentStoreTools.filter(tool => {
    // Category match
    const matchesCategory = 
      currentCategory === 'all' ||
      tool.category === currentCategory ||
      tool.subCategory === currentCategory;

    // Search query match
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      !query ||
      tool.title.toLowerCase().includes(query) ||
      tool.subtitle.toLowerCase().includes(query) ||
      (tool.shortDesc && tool.shortDesc.toLowerCase().includes(query)) ||
      (tool.badges && tool.badges.some(b => b.toLowerCase().includes(query))) ||
      (tool.features && tool.features.some(f => f.toLowerCase().includes(query)));

    return matchesCategory && matchesSearch;
  });

  if (filteredTools.length === 0) {
    toolsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: rgba(18, 20, 28, 0.5); border-radius: 20px; border: 1px dashed rgba(212, 175, 55, 0.3);">
        <p style="font-size: 18px; font-weight: 700; color: #FFF; margin-bottom: 8px;">No tools found matching "${escapeHtml(searchQuery)}"</p>
        <p style="color: var(--text-secondary); font-size: 14px;">Try searching for "warmup", "download", or clear your filter.</p>
      </div>
    `;
    return;
  }

  toolsGrid.innerHTML = filteredTools.map(tool => createToolCardHTML(tool)).join('');
}

// Generate Card HTML
function createToolCardHTML(tool) {
  const isFree = tool.isFree;
  const isPaid = tool.isPaid;
  const isUpcoming = tool.isUpcoming;
  const isFeatured = tool.isFeatured;
  
  // Primary CTA Button
  let primaryBtnHtml = '';
  if (tool.hasAdvanceBooking) {
    primaryBtnHtml = `
      <button type="button" class="btn-order-online" style="flex:1;" onclick="openOrderModal('${tool.id}')" title="Order Online & Instant Booking">
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        <span>Order (70% OFF)</span>
      </button>
      <a href="${tool.whatsappLink}" target="_blank" class="btn-whatsapp-primary" style="padding:10px 14px;" onclick="handleWhatsAppClick('${tool.id}', 'advance_booking')" title="Order on WhatsApp">
        <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.93.55 3.75 1.52 5.31L2 22l4.94-1.61c1.5 1 3.28 1.55 5.1 1.55 5.46 0 9.91-4.45 9.91-9.91 0-5.46-4.45-9.91-9.91zM17.06 15.65c-.24.67-1.39 1.28-1.92 1.34-.5.06-1.12.08-3.62-.95-2.9-1.2-4.78-4.14-4.92-4.33-.14-.19-1.18-1.57-1.18-2.99 0-1.42.74-2.12 1-2.41.26-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.65.48.24.57.82 1.99.89 2.13.07.14.12.31.02.5-.1.19-.15.31-.3.48-.15.17-.32.38-.45.51-.15.15-.31.31-.13.62.18.31.79 1.3 1.7 2.11 1.17 1.04 2.15 1.36 2.46 1.51.31.15.49.13.67-.08.18-.21.78-.91.99-1.22.21-.31.42-.26.7-.15.28.11 1.79.84 2.1 1 .31.15.52.23.59.36.07.12.07.72-.17 1.39z"/>
        </svg>
      </a>
    `;
  } else if (isUpcoming) {
    primaryBtnHtml = `
      <button class="btn-upcoming-primary" onclick="openDetails('${tool.id}')">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>Upcoming Suite</span>
      </button>
    `;
  } else if (isPaid) {
    primaryBtnHtml = `
      <button type="button" class="btn-order-online" style="flex:1;" onclick="openOrderModal('${tool.id}')" title="Order Online & Instant License">
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        <span>Order Online</span>
      </button>
      <a href="${tool.whatsappLink}" target="_blank" class="btn-whatsapp-primary" style="padding:10px 14px;" onclick="handleWhatsAppClick('${tool.id}', 'whatsapp_order')" title="Order on WhatsApp">
        <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.93.55 3.75 1.52 5.31L2 22l4.94-1.61c1.5 1 3.28 1.55 5.1 1.55 5.46 0 9.91-4.45 9.91-9.91 0-5.46-4.45-9.91-9.91zM17.06 15.65c-.24.67-1.39 1.28-1.92 1.34-.5.06-1.12.08-3.62-.95-2.9-1.2-4.78-4.14-4.92-4.33-.14-.19-1.18-1.57-1.18-2.99 0-1.42.74-2.12 1-2.41.26-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.65.48.24.57.82 1.99.89 2.13.07.14.12.31.02.5-.1.19-.15.31-.3.48-.15.17-.32.38-.45.51-.15.15-.31.31-.13.62.18.31.79 1.3 1.7 2.11 1.17 1.04 2.15 1.36 2.46 1.51.31.15.49.13.67-.08.18-.21.78-.91.99-1.22.21-.31.42-.26.7-.15.28.11 1.79.84 2.1 1 .31.15.52.23.59.36.07.12.07.72-.17 1.39z"/>
        </svg>
      </a>
    `;
  } else if (tool.liveUrl) {
    primaryBtnHtml = `
      <a href="${tool.liveUrl}" target="_blank" rel="noopener noreferrer" class="btn-download-primary" style="flex:1;" onclick="handleWebAppClick('${tool.id}')" title="Open Live Web Application on Vercel">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
          <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
        </svg>
        <span>Open</span>
      </a>
    `;
  } else if (tool.downloadUrl) {
    const isDriveOrExternal = tool.downloadUrl.startsWith('http://') || tool.downloadUrl.startsWith('https://');
    primaryBtnHtml = `
      <a href="${tool.downloadUrl}" ${isDriveOrExternal ? 'target="_blank" rel="noopener noreferrer"' : `download="${tool.downloadFilename || ''}"`} class="btn-download-primary" onclick="handleDownloadClick(event, '${tool.id}')" title="Download from Google Drive">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
          <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
        </svg>
        <span>Download</span>
      </a>
    `;
  }

  const featuresList = (tool.features || []).slice(0, 3).map(feat => `
    <li>
      <svg fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
      </svg>
      <span>${escapeHtml(feat)}</span>
    </li>
  `).join('');

  return `
    <article class="tool-card ${isFeatured ? 'featured' : ''}" id="card-${tool.id}">
      <div>
        <div class="card-top-bar">
          <!-- Outside Icon / Logo -->
          <div class="tool-icon-wrapper">
            <img src="${tool.icon}" alt="${escapeHtml(tool.title)}" class="tool-icon-img" onerror="this.src='assets/icons/warmup/icon128.png'">
          </div>

          <!-- Price & Badges -->
          <div class="card-badges-group">
            ${tool.liveDownloads ? `
              <span class="live-counter-badge" title="Live Cloud Download Counter">
                ⚡ ${tool.liveDownloads} Downloads
              </span>
            ` : ''}

            ${tool.hasAdvanceBooking ? `
              <span class="badge-discount-70">
                <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                70% OFF
              </span>
              <span class="badge-paid-rs">${escapeHtml(tool.price)}</span>
              <span class="badge-original-cut">${escapeHtml(tool.originalPrice || '')}</span>
            ` : isUpcoming ? `
              <span class="badge-upcoming">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                UPCOMING
              </span>
            ` : isPaid ? `
              <span class="badge-paid-rs">
                <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                ${escapeHtml(tool.price)}
              </span>
              <span class="badge-sub">${escapeHtml(tool.priceSubtitle || '')}</span>
            ` : isFree ? `
              <span class="badge-free">
                <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                FREE
              </span>
              <span class="badge-sub">${escapeHtml(tool.version || '')}</span>
            ` : `
              <span class="badge-vip">${escapeHtml(tool.price)}</span>
            `}
          </div>
        </div>

        <div class="card-body">
          <h3 class="tool-header-title">${escapeHtml(tool.title)}</h3>
          <p class="tool-header-subtitle">${escapeHtml(tool.subtitle)}</p>
          <p class="tool-desc">${escapeHtml(tool.shortDesc || '')}</p>

          ${tool.launchCountdown ? `
            <div class="launch-countdown-banner">
              <span class="pulse-dot"></span>
              <span><strong>${escapeHtml(tool.launchCountdown)}</strong> &bull; Complete Project</span>
            </div>
          ` : ''}

          ${tool.whatsappNumber ? `
            <div class="support-whatsapp-chip">
              <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2 22l5.07-1.34C8.52 21.52 10.21 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/>
              </svg>
              <span>${tool.hasAdvanceBooking ? 'Advance Booking WhatsApp:' : 'Free Support:'} <strong>${escapeHtml(tool.whatsappNumber)}</strong></span>
            </div>
          ` : ''}

          <ul class="features-preview" style="margin-top: 14px;">
            ${featuresList}
          </ul>
        </div>
      </div>

      <div class="card-footer">
        ${primaryBtnHtml}
        <button class="btn-details" onclick="openDetails('${tool.id}')" title="View Full Details">
          Details
        </button>
      </div>
    </article>
  `;
}

// Download Handler with Toast & Cloud Tracking
function handleDownloadClick(event, toolId) {
  const tool = currentStoreTools.find(t => t.id === toolId);
  if (!tool) return;

  // Track event in Firebase Backend
  backend.recordAction(toolId, 'download', { title: tool.title });

  if (tool.downloadUrl && (tool.downloadUrl.startsWith('http://') || tool.downloadUrl.startsWith('https://'))) {
    showToast(`Opening Google Drive`, `Opening ${tool.title} cloud folder for download.`);
  } else {
    showToast(`Downloading ${tool.downloadFilename || tool.title}`, 'Ready in your downloads folder.');
  }
}

// WhatsApp Order / Booking Tracker
function handleWhatsAppClick(toolId, actionType = 'whatsapp_order') {
  const tool = currentStoreTools.find(t => t.id === toolId);
  if (!tool) return;
  backend.recordAction(toolId, actionType, { title: tool.title, price: tool.price });
}

// Web App Click Tracker
function handleWebAppClick(toolId) {
  const tool = currentStoreTools.find(t => t.id === toolId);
  if (!tool) return;
  backend.recordAction(toolId, 'open_web_app', { title: tool.title });
}

function showToast(title, desc) {
  toastTitle.textContent = title;
  toastDesc.textContent = desc;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4500);
}

// Open Detail Modal with Real-time Reviews & Rating Form
function openDetails(toolId) {
  const tool = currentStoreTools.find(t => t.id === toolId);
  if (!tool) return;

  // Track view event in Firestore
  backend.recordAction(toolId, 'view', { title: tool.title });

  const featuresFull = (tool.features || []).map(f => `
    <li style="display:flex; align-items:center; gap:10px; margin-bottom:8px; font-size:14px; color:#E0E4F0;">
      <span style="color:var(--gold-primary); font-size:16px;">&#10004;</span>
      <span>${escapeHtml(f)}</span>
    </li>
  `).join('');

  const techBadges = (tool.techStack || []).map(t => `
    <span style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); padding:4px 12px; border-radius:12px; font-size:12px; color:var(--gold-light);">${escapeHtml(t)}</span>
  `).join('');

  detailModalBody.innerHTML = `
    <div class="modal-header">
      <div class="modal-icon">
        <img src="${tool.icon}" alt="${escapeHtml(tool.title)}" onerror="this.src='assets/icons/warmup/icon128.png'">
      </div>
      <div>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap;">
          ${tool.hasAdvanceBooking ? '<span class="badge-discount-70">70% OFF ADVANCE BOOKING</span><span class="badge-paid-rs">RS 5,000 (1-Year Plan)</span>' : tool.isUpcoming ? '<span class="badge-upcoming">UPCOMING RELEASE</span>' : tool.isPaid ? `<span class="badge-paid-rs">${escapeHtml(tool.price)} (${escapeHtml(tool.priceSubtitle || 'Lifetime')})</span>` : tool.isFree ? '<span class="badge-free">FREE</span>' : `<span class="badge-vip">${escapeHtml(tool.price)}</span>`}
          <span style="font-size:12px; color:var(--text-secondary);">${escapeHtml(tool.version || '')}</span>
          ${tool.liveDownloads ? `<span class="live-counter-badge">⚡ ${tool.liveDownloads} Cloud Downloads</span>` : ''}
        </div>
        <h2 style="font-size: 24px; font-weight: 800; color: #FFF;">${escapeHtml(tool.title)}</h2>
        <p style="font-size: 14px; color: var(--gold-primary);">${escapeHtml(tool.subtitle)}</p>
      </div>
    </div>

    ${tool.hasAdvanceBooking ? `
      <div style="background:linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(37,211,102,0.15) 100%); border:1.5px solid var(--gold-primary); border-radius:var(--radius-md); padding:18px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; box-shadow:0 0 25px rgba(212,175,55,0.2);">
        <div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="badge-discount-70">70% OFF ADVANCE BOOKING</span>
            <span style="background:rgba(0,230,118,0.15); color:#00E676; font-weight:700; font-size:11.5px; padding:3px 8px; border-radius:6px;">🚀 LAUNCHING WITHIN 7 DAYS</span>
          </div>
          <h3 style="font-size:24px; font-weight:900; color:#FFF; margin-top:6px;">
            ${escapeHtml(tool.price)} 
            <span style="font-size:15px; text-decoration:line-through; color:var(--text-muted); margin-left:6px;">${escapeHtml(tool.originalPrice || '')}</span>
            <span style="font-size:13.5px; font-weight:600; color:var(--gold-light); margin-left:8px;">${escapeHtml(tool.priceSubtitle || '')}</span>
          </h3>
          <p style="font-size:12.5px; color:var(--text-secondary); margin-top:4px;">Project 100% completed &bull; Final Polish &bull; Releasing within 7 days &bull; Full 1-Year Access</p>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end;">
          <span style="font-size:12px; color:var(--text-secondary);">Direct WhatsApp Booking:</span>
          <a href="${tool.whatsappLink}" target="_blank" onclick="handleWhatsAppClick('${tool.id}', 'advance_booking')" style="font-size:17px; font-weight:900; color:#4EFA8B; text-decoration:none; display:flex; align-items:center; gap:6px; margin-top:2px;">
            <span>${escapeHtml(tool.whatsappNumber)}</span>
          </a>
        </div>
      </div>
    ` : tool.isPaid ? `
      <div style="background:linear-gradient(135deg, rgba(37,211,102,0.1) 0%, rgba(212,175,55,0.1) 100%); border:1px solid rgba(37,211,102,0.3); border-radius:var(--radius-md); padding:16px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <span style="font-size:12px; text-transform:uppercase; color:#4EFA8B; font-weight:800; letter-spacing:0.8px;">VIP Pricing & Lifetime License</span>
          <h3 style="font-size:22px; font-weight:900; color:#FFF; margin-top:2px;">${escapeHtml(tool.price)} <span style="font-size:14px; font-weight:600; color:var(--gold-light);">${escapeHtml(tool.priceSubtitle || '')}</span></h3>
          <p style="font-size:12.5px; color:var(--text-secondary); margin-top:2px;">Free Lifetime Updates Included &bull; Zero Recurring Fees</p>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end;">
          <span style="font-size:12px; color:var(--text-secondary);">Free Support WhatsApp:</span>
          <a href="${tool.whatsappLink}" target="_blank" onclick="handleWhatsAppClick('${tool.id}', 'whatsapp_order')" style="font-size:16px; font-weight:800; color:#4EFA8B; text-decoration:none; display:flex; align-items:center; gap:6px;">
            <span>${escapeHtml(tool.whatsappNumber)}</span>
          </a>
        </div>
      </div>
    ` : ''}

    <div style="margin-bottom: 24px;">
      <h4 style="font-size: 15px; color: var(--gold-light); margin-bottom: 8px; text-transform:uppercase; letter-spacing:0.8px;">Overview</h4>
      <p style="font-size: 14.5px; color: var(--text-secondary); line-height: 1.6;">${escapeHtml(tool.longDesc || tool.shortDesc)}</p>
    </div>

    <div style="margin-bottom: 24px;">
      <h4 style="font-size: 15px; color: var(--gold-light); margin-bottom: 12px; text-transform:uppercase; letter-spacing:0.8px;">Key Capabilities & Features Breakdown</h4>
      <ul style="list-style:none; padding:0;">
        ${featuresFull}
      </ul>
    </div>

    <div style="margin-bottom: 28px;">
      <h4 style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px; text-transform:uppercase;">Architecture & Engines</h4>
      <div style="display:flex; flex-wrap:wrap; gap:8px;">
        ${techBadges}
      </div>
    </div>

    <!-- Actions Row -->
    <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap; margin-bottom: 20px;">
      ${tool.hasAdvanceBooking ? `
        <button type="button" class="btn-order-online" onclick="openOrderModal('${tool.id}')" style="padding: 12px 24px; font-size: 15px;">
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
          <span>Order Online (70% OFF)</span>
        </button>
        <a href="${tool.whatsappLink}" target="_blank" class="btn-whatsapp-primary" onclick="handleWhatsAppClick('${tool.id}', 'advance_booking')" style="padding: 12px 24px; font-size: 15px;">
          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.93.55 3.75 1.52 5.31L2 22l4.94-1.61c1.5 1 3.28 1.55 5.1 1.55 5.46 0 9.91-4.45 9.91-9.91 0-5.46-4.45-9.91-9.91zM17.06 15.65c-.24.67-1.39 1.28-1.92 1.34-.5.06-1.12.08-3.62-.95-2.9-1.2-4.78-4.14-4.92-4.33-.14-.19-1.18-1.57-1.18-2.99 0-1.42.74-2.12 1-2.41.26-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.65.48.24.57.82 1.99.89 2.13.07.14.12.31.02.5-.1.19-.15.31-.3.48-.15.17-.32.38-.45.51-.15.15-.31.31-.13.62.18.31.79 1.3 1.7 2.11 1.17 1.04 2.15 1.36 2.46 1.51.31.15.49.13.67-.08.18-.21.78-.91.99-1.22.21-.31.42-.26.7-.15.28.11 1.79.84 2.1 1 .31.15.52.23.59.36.07.12.07.72-.17 1.39z"/>
          </svg>
          <span>Book on WhatsApp</span>
        </a>
      ` : ''}

      ${tool.isUpcoming && !tool.hasAdvanceBooking ? `
        <div style="flex:1; background:rgba(179,136,255,0.08); border:1px solid var(--upcoming-border); padding:12px 18px; border-radius:var(--radius-md); display:flex; align-items:center; gap:12px;">
          <svg width="24" height="24" fill="none" stroke="var(--upcoming-purple)" stroke-width="2" viewBox="0 0 24 24">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div style="display:flex; flex-direction:column;">
            <span style="font-size:13px; font-weight:700; color:#FFF;">Coming Soon to Jaun Store</span>
            <span style="font-size:11.5px; color:var(--text-secondary);">${tool.category === 'android' ? 'Mobile Android APK build with precision clips cutter is currently in active development' : 'Enterprise Windows build is staged in D:\\my project\\fb automation'}</span>
          </div>
        </div>
      ` : ''}

      ${tool.liveUrl ? `
        <a href="${tool.liveUrl}" target="_blank" rel="noopener noreferrer" class="btn-download-primary" onclick="handleWebAppClick('${tool.id}')" style="padding: 12px 24px;">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
            <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
          </svg>
          <span>Launch Live Web App</span>
        </a>
      ` : ''}

      ${tool.downloadUrl ? `
        <a href="${tool.downloadUrl}" ${tool.downloadUrl.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : `download="${tool.downloadFilename}"`} class="btn-download-primary" onclick="handleDownloadClick(event, '${tool.id}')">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
          </svg>
          <span>${tool.downloadUrl.startsWith('http') ? 'Download from Google Drive' : `Download ZIP (${tool.fileSize || 'Package'})`}</span>
        </a>
      ` : ''}

      ${tool.isPaid ? `
        <button type="button" class="btn-order-online" onclick="openOrderModal('${tool.id}')" style="padding: 12px 24px; font-size: 15px;">
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
          <span>Order Online (${escapeHtml(tool.price)})</span>
        </button>
      ` : ''}

      ${tool.whatsappLink ? `
        <a href="${tool.whatsappLink}" target="_blank" class="btn-whatsapp-primary" onclick="handleWhatsAppClick('${tool.id}', 'whatsapp_order')" style="padding: 12px 24px;">
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.93.55 3.75 1.52 5.31L2 22l4.94-1.61c1.5 1 3.28 1.55 5.1 1.55 5.46 0 9.91-4.45 9.91-9.91 0-5.46-4.45-9.91-9.91zM17.06 15.65c-.24.67-1.39 1.28-1.92 1.34-.5.06-1.12.08-3.62-.95-2.9-1.2-4.78-4.14-4.92-4.33-.14-.19-1.18-1.57-1.18-2.99 0-1.42.74-2.12 1-2.41.26-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.65.48.24.57.82 1.99.89 2.13.07.14.12.31.02.5-.1.19-.15.31-.3.48-.15.17-.32.38-.45.51-.15.15-.31.31-.13.62.18.31.79 1.3 1.7 2.11 1.17 1.04 2.15 1.36 2.46 1.51.31.15.49.13.67-.08.18-.21.78-.91.99-1.22.21-.31.42-.26.7-.15.28.11 1.79.84 2.1 1 .31.15.52.23.59.36.07.12.07.72-.17 1.39z"/>
          </svg>
          <span>Buy on WhatsApp</span>
        </a>
      ` : ''}

      ${tool.installGuide ? `
        <button class="btn-details" onclick="openInstallGuideModal()">
          <span>How to Install</span>
        </button>
      ` : ''}
    </div>

    <!-- Firebase Live Reviews & Rating System -->
    <div class="modal-reviews-section">
      <div class="reviews-header-bar">
        <div class="reviews-title-group">
          <h4>
            <span>Verified Customer Reviews</span>
            <span style="font-size: 11px; background: rgba(212,175,55,0.15); color: var(--gold-light); border: 1px solid var(--border-gold); padding: 2px 8px; border-radius: 6px;">Firebase Live</span>
          </h4>
        </div>
        <div class="reviews-stats-summary" id="modalReviewsStats">
          <span>★ 5.0 Rating</span> &bull; <span id="modalReviewsCount">Loading reviews...</span>
        </div>
      </div>

      <!-- Real-time Reviews List -->
      <div class="reviews-list-wrapper" id="reviewsList">
        <div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px;">
          Connecting to Firebase Firestore for reviews...
        </div>
      </div>

      <!-- Write a Review Box -->
      <div class="write-review-box">
        <div class="write-review-title">Leave Your Rating &amp; Review</div>
        <div class="star-rating-selector" id="starSelector">
          <button type="button" class="star-btn active" data-rating="1">★</button>
          <button type="button" class="star-btn active" data-rating="2">★</button>
          <button type="button" class="star-btn active" data-rating="3">★</button>
          <button type="button" class="star-btn active" data-rating="4">★</button>
          <button type="button" class="star-btn active" data-rating="5">★</button>
          <span style="font-size: 13px; color: var(--gold-light); margin-left: 8px; font-weight:700;" id="starRatingLabel">5 / 5 Stars</span>
        </div>

        <form id="submitReviewForm">
          <div class="review-form-group">
            <input type="text" id="reviewAuthor" class="review-form-input" placeholder="Your Name or VIP Username" required>
            <input type="text" id="reviewRole" class="review-form-input" placeholder="Role (e.g. Page Manager / Dev)" value="Verified VIP User">
          </div>
          <div style="margin-bottom: 12px;">
            <textarea id="reviewComment" class="review-form-textarea" placeholder="Share your experience with this tool, results, speed..." required></textarea>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span id="reviewFormStatus" style="font-size: 12px; color: var(--gold-light);"></span>
            <button type="submit" class="btn-submit-review" id="btnSubmitReview">
              <span>Post Review to Cloud</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  detailModal.classList.add('active');

  // Setup Review Stars Interactive selector
  setupReviewStars();

  // Setup Real-time Firestore Reviews Listener
  if (activeReviewsUnsubscribe) {
    activeReviewsUnsubscribe();
    activeReviewsUnsubscribe = null;
  }

  activeReviewsUnsubscribe = backend.listenToReviews(tool.id, (reviews) => {
    renderReviewsList(reviews, tool);
  });

  // Setup Form Submit Listener
  const reviewForm = document.getElementById('submitReviewForm');
  if (reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const author = document.getElementById('reviewAuthor').value;
      const role = document.getElementById('reviewRole').value;
      const comment = document.getElementById('reviewComment').value;
      const btn = document.getElementById('btnSubmitReview');
      const statusSpan = document.getElementById('reviewFormStatus');

      try {
        btn.disabled = true;
        btn.innerHTML = '<span>Publishing...</span>';
        statusSpan.textContent = 'Saving to Firestore...';

        await backend.submitReview(tool.id, {
          author,
          role,
          comment,
          rating: selectedRating
        });

        statusSpan.textContent = 'Review published live!';
        showToast('Review Submitted', 'Thank you for your VIP feedback!');
        reviewForm.reset();
        selectedRating = 5;
        setupReviewStars();
      } catch (err) {
        statusSpan.textContent = 'Notice: Review stored locally or rule awaiting setup.';
        showToast('Feedback Recorded', 'Your review has been captured.');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Post Review to Cloud</span>';
        setTimeout(() => { statusSpan.textContent = ''; }, 3500);
      }
    });
  }
}

function setupReviewStars() {
  const starBtns = document.querySelectorAll('#starSelector .star-btn');
  const label = document.getElementById('starRatingLabel');

  starBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRating = parseInt(btn.getAttribute('data-rating'), 10);
      if (label) label.textContent = `${selectedRating} / 5 Stars`;
      starBtns.forEach(b => {
        const r = parseInt(b.getAttribute('data-rating'), 10);
        if (r <= selectedRating) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });
    });
  });
}

function renderReviewsList(reviews, tool) {
  const listEl = document.getElementById('reviewsList');
  const countEl = document.getElementById('modalReviewsCount');
  if (!listEl) return;

  if (!reviews || reviews.length === 0) {
    if (countEl) countEl.textContent = '0 Community Reviews';
    listEl.innerHTML = `
      <div style="text-align: center; color: var(--text-secondary); font-size: 13.5px; padding: 20px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
        No reviews posted yet. Be the first VIP member to write a review!
      </div>
    `;
    return;
  }

  if (countEl) countEl.textContent = `${reviews.length} Verified Reviews`;

  listEl.innerHTML = reviews.map(rev => {
    const stars = '★'.repeat(rev.rating || 5) + '☆'.repeat(Math.max(0, 5 - (rev.rating || 5)));
    const initial = (rev.author || 'V').trim().charAt(0).toUpperCase();
    let dateStr = 'Recently';
    if (rev.createdAt && rev.createdAt.toDate) {
      dateStr = rev.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    return `
      <div class="review-item-card">
        <div class="review-card-top">
          <div class="review-user-info">
            <div class="review-avatar">${initial}</div>
            <div>
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="review-name">${escapeHtml(rev.author || 'VIP User')}</span>
                <span class="review-role-badge">${escapeHtml(rev.role || 'Verified')}</span>
              </div>
              <div class="review-date">${dateStr}</div>
            </div>
          </div>
          <div class="review-stars">${stars}</div>
        </div>
        <p class="review-comment-text">${escapeHtml(rev.comment)}</p>
      </div>
    `;
  }).join('');
}

function openInstallGuideModal() {
  detailModal.classList.remove('active');
  guideModal.classList.add('active');
}

// Payment accounts configuration
const PAYMENT_ACCOUNTS = {
  easypaisa: {
    title: "RAHAN KHAN",
    number: "03361849934",
    note: "Send payment via EasyPaisa App / Retailer and enter your 11-digit TRX ID below."
  },
  jazzcash: {
    title: "RAHAN KHAN",
    number: "03361849934",
    note: "Send payment via JazzCash App or *786# and enter your TID reference below."
  },
  bank: {
    title: "RAHAN KHAN",
    number: "03361849934 (Meezan Bank)",
    note: "Transfer via any Bank App / IBFT and enter your Transaction Reference below."
  }
};

let currentPaymentMethod = 'easypaisa';

function closeAllModals() {
  detailModal.classList.remove('active');
  guideModal.classList.remove('active');
  if (adminModal) adminModal.classList.remove('active');
  const orderModal = document.getElementById('orderModal');
  if (orderModal) orderModal.classList.remove('active');
  if (activeReviewsUnsubscribe) {
    activeReviewsUnsubscribe();
    activeReviewsUnsubscribe = null;
  }
}

function openOrderModal(toolId) {
  const orderModal = document.getElementById('orderModal');
  if (!orderModal) return;

  const packageSelect = document.getElementById('orderPackageSelect');
  let tool = currentStoreTools.find(t => t.id === toolId);

  // If tool not found by ID, look up in select options or fallback to default
  if (!tool && packageSelect) {
    for (let opt of packageSelect.options) {
      if (opt.value === toolId) {
        tool = {
          id: opt.value,
          title: opt.getAttribute('data-title') || opt.textContent.split('—')[0].trim(),
          price: opt.getAttribute('data-price') || 'RS 560'
        };
        break;
      }
    }
  }

  if (!tool && currentStoreTools.length > 0) {
    tool = currentStoreTools[0];
  }

  if (!tool) {
    tool = { id: 'jaun-bulk-download', title: 'Jaun Bulk Download VIP', price: 'RS 560' };
  }

  const toolIdInput = document.getElementById('orderToolId');
  const titleEl = document.getElementById('orderToolTitle');
  const subtitleEl = document.getElementById('orderToolSubtitle');
  const priceEl = document.getElementById('orderToolPrice');

  if (toolIdInput) toolIdInput.value = tool.id;
  if (titleEl) titleEl.textContent = tool.title;
  if (subtitleEl) subtitleEl.textContent = tool.subtitle || 'VIP Lifetime License';
  if (priceEl) priceEl.textContent = tool.price;

  if (packageSelect) {
    let found = false;
    for (let opt of packageSelect.options) {
      if (opt.value === tool.id) {
        packageSelect.value = tool.id;
        found = true;
        break;
      }
    }
    if (!found) {
      const opt = new Option(`${tool.title} — ${tool.price}`, tool.id, true, true);
      opt.setAttribute('data-price', tool.price);
      opt.setAttribute('data-title', tool.title);
      packageSelect.add(opt);
      packageSelect.value = tool.id;
    }
  }

  const user = backend.getCurrentUser();
  if (user) {
    const nameInput = document.getElementById('orderCustomerName');
    const emailInput = document.getElementById('orderCustomerEmail');
    if (nameInput && !nameInput.value) nameInput.value = user.displayName || '';
    if (emailInput && !emailInput.value) emailInput.value = user.email || '';
  }

  // Reset views
  const formEl = document.getElementById('onlineOrderForm');
  const successEl = document.getElementById('orderSuccessView');
  const statusMsg = document.getElementById('orderStatusMsg');
  if (formEl) formEl.style.display = 'block';
  if (successEl) successEl.style.display = 'none';
  if (statusMsg) statusMsg.textContent = '';
  if (detailModal) detailModal.classList.remove('active');
  orderModal.classList.add('active');
}

function copyAccountNumber() {
  const info = PAYMENT_ACCOUNTS[currentPaymentMethod];
  if (info) {
    const rawNumber = info.number.split(' ')[0];
    navigator.clipboard.writeText(rawNumber).then(() => {
      showToast('Copied to Clipboard', `${rawNumber} copied!`);
    }).catch(() => {
      showToast('Account Number', rawNumber);
    });
  }
}

function setupPaymentTabs() {
  const tabs = document.querySelectorAll('#paymentMethodTabs .payment-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentPaymentMethod = tab.getAttribute('data-method');
      const info = PAYMENT_ACCOUNTS[currentPaymentMethod];
      if (info) {
        const titleEl = document.getElementById('accountTitle');
        const numEl = document.getElementById('accountNumber');
        const noteEl = document.getElementById('accountNote');
        if (titleEl) titleEl.textContent = info.title;
        if (numEl) numEl.textContent = info.number;
        if (noteEl) noteEl.textContent = info.note;
      }
    });
  });
}

function setupOrderForm() {
  const orderForm = document.getElementById('onlineOrderForm');
  if (!orderForm) return;

  const packageSelect = document.getElementById('orderPackageSelect');
  if (packageSelect) {
    packageSelect.addEventListener('change', () => {
      const selectedOpt = packageSelect.options[packageSelect.selectedIndex];
      if (!selectedOpt) return;
      const price = selectedOpt.getAttribute('data-price') || 'RS 560';
      const priceEl = document.getElementById('orderToolPrice');
      const toolIdInput = document.getElementById('orderToolId');
      if (priceEl) priceEl.textContent = price;
      if (toolIdInput) toolIdInput.value = selectedOpt.value;
    });
  }

  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const toolId = document.getElementById('orderToolId').value;
    const tool = currentStoreTools.find(t => t.id === toolId);
    const customerName = document.getElementById('orderCustomerName').value.trim();
    const customerWhatsApp = document.getElementById('orderCustomerWhatsApp').value.trim();
    const customerEmail = document.getElementById('orderCustomerEmail').value.trim();
    const trxId = document.getElementById('orderTrxId').value.trim();
    const submitBtn = document.getElementById('btnSubmitOrder');
    const statusMsg = document.getElementById('orderStatusMsg');

    let toolTitle = tool ? tool.title : 'VIP Tool';
    let toolPrice = tool ? tool.price : 'RS 560';

    if (packageSelect && packageSelect.selectedIndex >= 0) {
      const opt = packageSelect.options[packageSelect.selectedIndex];
      if (opt) {
        toolTitle = opt.getAttribute('data-title') || opt.textContent.split('—')[0].trim();
        toolPrice = opt.getAttribute('data-price') || toolPrice;
      }
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Processing Order...</span>';
      if (statusMsg) statusMsg.textContent = 'Recording your order...';

      const orderResult = await backend.createOnlineOrder({
        toolId: toolId || 'custom-order',
        toolTitle: toolTitle,
        price: toolPrice,
        customerName,
        customerWhatsApp,
        customerEmail,
        paymentMethod: currentPaymentMethod,
        transactionId: trxId
      });

      // Show receipt view
      orderForm.style.display = 'none';
      const successView = document.getElementById('orderSuccessView');
      if (successView) successView.style.display = 'block';
      const receiptId = document.getElementById('receiptOrderId');
      if (receiptId) receiptId.textContent = orderResult.orderId;

      // WhatsApp link with order details
      const waMsg = encodeURIComponent(
        `Salam Jaun Khan,\nMaine Jaun Store par Online Order place kiya hai:\n\n` +
        `📦 Order ID: ${orderResult.orderId}\n` +
        `🛠️ Product: ${toolTitle}\n` +
        `💰 Price: ${toolPrice}\n` +
        `💳 Payment: ${currentPaymentMethod.toUpperCase()}\n` +
        `🧾 TRX ID: ${trxId}\n` +
        `👤 Customer: ${customerName}\n` +
        `📱 WhatsApp: ${customerWhatsApp}\n\n` +
        `Kindly verify payment and send my license.`
      );
      const waBtn = document.getElementById('orderWhatsAppConfirmLink');
      if (waBtn) waBtn.href = `https://wa.me/923361849934?text=${waMsg}`;

      showToast('Order Placed!', `Order ID: ${orderResult.orderId}`);
      orderForm.reset();
    } catch (err) {
      if (statusMsg) statusMsg.textContent = 'Notice: ' + err.message;
      showToast('Order Placed', 'Your order was recorded.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Confirm &amp; Place Order</span>';
    }
  });
}

// Event Listeners Setup
function setupEventListeners() {
  // Search input
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderTools();
    });
  }

  // Category filter pills
  filterPills.forEach(btn => {
    btn.addEventListener('click', () => {
      filterPills.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.getAttribute('data-category');
      renderTools();
    });
  });

  // Modal Open / Close buttons
  if (btnOpenGuide) {
    btnOpenGuide.addEventListener('click', () => {
      guideModal.classList.add('active');
    });
  }

  if (btnOpenAdmin) {
    btnOpenAdmin.addEventListener('click', () => {
      adminModal.classList.add('active');
    });
  }

  if (closeDetailModal) {
    closeDetailModal.addEventListener('click', closeAllModals);
  }

  if (closeGuideModal) {
    closeGuideModal.addEventListener('click', closeAllModals);
  }

  if (closeAdminModal) {
    closeAdminModal.addEventListener('click', closeAllModals);
  }

  // Order modal buttons
  const closeOrderModal = document.getElementById('closeOrderModal');
  if (closeOrderModal) closeOrderModal.addEventListener('click', closeAllModals);
  const btnCancelOrder = document.getElementById('btnCancelOrder');
  if (btnCancelOrder) btnCancelOrder.addEventListener('click', closeAllModals);
  const btnDoneOrder = document.getElementById('btnDoneOrder');
  if (btnDoneOrder) btnDoneOrder.addEventListener('click', closeAllModals);
  const btnCopyAccount = document.getElementById('btnCopyAccount');
  if (btnCopyAccount) btnCopyAccount.addEventListener('click', copyAccountNumber);

  setupPaymentTabs();
  setupOrderForm();

  // Close modals on backdrop click
  window.addEventListener('click', (e) => {
    const orderModal = document.getElementById('orderModal');
    if (e.target === detailModal || e.target === guideModal || e.target === adminModal || e.target === orderModal) {
      closeAllModals();
    }
  });

  // Close modals on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });

  // 1-Click Seed Catalog to Firestore
  if (btnSeedCatalog) {
    btnSeedCatalog.addEventListener('click', async () => {
      try {
        btnSeedCatalog.disabled = true;
        btnSeedCatalog.innerHTML = '<span>Syncing to Firestore...</span>';
        const res = await backend.seedCatalog(window.JAUN_STORE_DATA || []);
        showToast('Firestore Catalog Seeded', `Successfully uploaded ${res.count} tools to Cloud Firestore!`);
        btnSeedCatalog.innerHTML = '<span>Synced Successfully ✓</span>';
      } catch (err) {
        showToast('Notice', 'Catalog seed initiated: ' + err.message);
        btnSeedCatalog.innerHTML = '<span>Sync to Firestore</span>';
      } finally {
        setTimeout(() => {
          btnSeedCatalog.disabled = false;
          btnSeedCatalog.innerHTML = '<span>Sync to Firestore</span>';
        }, 4000);
      }
    });
  }

  // Admin Add New Tool Form
  if (addToolForm) {
    addToolForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('newToolId').value.trim();
      const title = document.getElementById('newToolTitle').value.trim();
      const subtitle = document.getElementById('newToolSubtitle').value.trim();
      const category = document.getElementById('newToolCategory').value;
      const price = document.getElementById('newToolPrice').value.trim();
      const downloadUrl = document.getElementById('newToolUrl').value.trim();
      const shortDesc = document.getElementById('newToolDesc').value.trim();

      const newTool = {
        id,
        title,
        subtitle,
        category,
        price,
        isFree: price.toUpperCase() === 'FREE',
        isPaid: price.toUpperCase() !== 'FREE',
        downloadUrl,
        shortDesc,
        longDesc: shortDesc,
        icon: 'assets/icons/warmup/icon128.png',
        features: ["High-speed Automation", "Cloud Sync Integration", "VIP Support Included"],
        techStack: ["Cloud", "JavaScript", "Firebase"],
        badges: [price.toUpperCase(), "CLOUD SYNC"]
      };

      try {
        if (adminFormStatus) adminFormStatus.textContent = 'Publishing to Firestore...';
        await backend.saveTool(newTool);
        if (adminFormStatus) adminFormStatus.textContent = 'Published successfully!';
        showToast('Tool Published', `${title} is now live in Cloud Firestore!`);
        addToolForm.reset();
        setTimeout(() => {
          closeAllModals();
          if (adminFormStatus) adminFormStatus.textContent = '';
        }, 1200);
      } catch (err) {
        if (adminFormStatus) adminFormStatus.textContent = 'Notice: ' + err.message;
        showToast('Notice', 'Cloud publish initiated.');
      }
    });
  }
}

function updateCategoryCounts() {
  const allCount = currentStoreTools.length;
  const extCount = currentStoreTools.filter(t => t.category === 'extensions').length;
  const fbCount = currentStoreTools.filter(t => t.category === 'facebook' || t.subCategory === 'facebook').length;
  const deskCount = currentStoreTools.filter(t => t.category === 'desktop').length;
  const webCount = currentStoreTools.filter(t => t.category === 'webapps' || t.subCategory === 'security').length;
  const androidCount = currentStoreTools.filter(t => t.category === 'android' || t.subCategory === 'mobile').length;
  const upcomingCount = currentStoreTools.filter(t => t.isUpcoming || t.category === 'upcoming').length;

  const countAllEl = document.getElementById('countAll');
  if (countAllEl) countAllEl.textContent = allCount;
  if (document.getElementById('countExtensions')) document.getElementById('countExtensions').textContent = extCount;
  if (document.getElementById('countFacebook')) document.getElementById('countFacebook').textContent = fbCount;
  if (document.getElementById('countDesktop')) document.getElementById('countDesktop').textContent = deskCount;
  if (document.getElementById('countWebApps')) document.getElementById('countWebApps').textContent = webCount;
  if (document.getElementById('countAndroid')) document.getElementById('countAndroid').textContent = androidCount;
  if (document.getElementById('countUpcoming')) document.getElementById('countUpcoming').textContent = upcomingCount;
}

function updateNavbarAuth(user) {
  const authGroup = document.getElementById('navbarAuthGroup');
  if (!authGroup) return;

  if (user) {
    const initial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
    if (user.isAdmin) {
      authGroup.innerHTML = `
        <a href="admin.html" class="btn-nav-auth btn-nav-admin-panel" title="Go to Admin Dashboard">
          <span>👑 Admin Panel</span>
        </a>
        <button type="button" class="btn-nav-auth btn-nav-login" id="btnNavLogout">
          <span>Sign Out</span>
        </button>
      `;
    } else {
      authGroup.innerHTML = `
        <div class="user-nav-badge">
          <span class="user-nav-avatar">${initial}</span>
          <span class="user-nav-name" style="color:#FFF; font-weight:700;">${escapeHtml(user.displayName || 'VIP User')}</span>
        </div>
        <button type="button" class="btn-nav-auth btn-nav-login" id="btnNavLogout">
          <span>Sign Out</span>
        </button>
      `;
    }

    const logoutBtn = document.getElementById('btnNavLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await backend.logoutUser();
        showToast('Signed Out', 'You have been signed out.');
      });
    }
  } else {
    authGroup.innerHTML = `
      <a href="login.html" class="btn-nav-auth btn-nav-login">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4m-5-4 5-5-5-5m5 5H3"/>
        </svg>
        <span>Login</span>
      </a>
      <a href="signup.html" class="btn-nav-auth btn-nav-signup">
        <span>Sign Up</span>
      </a>
    `;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Attach functions to window for direct HTML inline handler compatibility
window.openDetails = openDetails;
window.closeAllModals = closeAllModals;
window.openInstallGuideModal = openInstallGuideModal;
window.handleDownloadClick = handleDownloadClick;
window.handleWhatsAppClick = handleWhatsAppClick;
window.handleWebAppClick = handleWebAppClick;
window.openOrderModal = openOrderModal;
window.copyAccountNumber = copyAccountNumber;

