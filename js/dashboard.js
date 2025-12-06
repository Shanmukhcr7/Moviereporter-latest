// js/dashboard.js

// Firebase imports
import { db, auth, storage, currentUser, currentUserId, userRole, isAuthReady } from './firebase-init.js';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, orderBy, Timestamp, runTransaction, setDoc,limit,startAfter } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
// Utility imports
import { showToast, showCustomModal, formatDate, formatDateTime, isAdmin, escapeHtmlAttributeString } from './utils.js'; // UPDATED IMPORT
import { createUserWithEmailAndPassword, updatePassword, updateEmail, deleteUser } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Get app ID from global variable (essential for multi-tenant Firestore structure)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- DOM Elements Cache ---
// Sidebar Navigation elements
const sidebarNav = document.querySelector('.dashboard-nav ul');
const tabContents = document.querySelectorAll('.tab-content');

// Modals and their associated forms/previews
const movieFormModal = document.getElementById('movie-form-modal');
const movieForm = document.getElementById('movie-form');
const movieModalTitle = document.getElementById('movie-modal-title');
const currentMoviePosterPreview = document.getElementById('current-movie-poster-preview');
const movieOttPublishedCheckbox = document.getElementById('movie-ott-published');
const movieIsPopularCheckbox = document.getElementById('movie-is-popular');
const movieIsTopBoxOfficeCheckbox = document.getElementById('movie-is-top-box-office');
const movieCastInput = document.getElementById('movie-cast-input');
const addCastMemberToMovieBtn = document.getElementById('add-cast-member-to-movie');
const selectedCastDisplay = document.getElementById('selected-cast-display');
const movieCastDataHiddenInput = document.getElementById('movie-cast-data');
const celebritySuggestionsDiv = document.getElementById('celebrity-suggestions'); // This is for movie cast

// News Modals and Forms
const newsFormModal = document.getElementById('news-form-modal');
const newsForm = document.getElementById('news-form');
const newsModalTitle = document.getElementById('news-modal-title');
const currentNewsImagePreview = document.getElementById('current-news-image-preview');

// Blog Modals and Forms
const blogFormModal = document.getElementById('blog-form-modal');
const blogForm = document.getElementById('blog-form');
const blogModalTitle = document.getElementById('blog-modal-title');
const currentBlogImagePreview = document.getElementById('current-blog-image-preview');

// Celebrity Modals and Forms
const celebrityFormModal = document.getElementById('celebrity-form-modal');
const celebrityForm = document.getElementById('celebrity-form');
const celebrityModalTitle = document.getElementById('celebrity-modal-title');
const currentCelebrityImagePreview = document.getElementById('current-celebrity-image-preview');


const categoryFormModal = document.getElementById('category-form-modal');
const categoryForm = document.getElementById('category-form');
const categoryModalTitle = document.getElementById('category-modal-title');

const nomineeFormModal = document.getElementById('nominee-form-modal');
const nomineeForm = document.getElementById('nominee-form');
const nomineeModalTitle = document.getElementById('nominee-modal-title');
const currentNomineePhotoPreview = document.getElementById('current-nominee-photo-preview');
const nomineeCelebritySearchInput = document.getElementById('nominee-celebrity-search-input');
const nomineeCelebritySuggestionsDiv = document.getElementById('nominee-celebrity-suggestions'); // This is for nominee celebrity search
const addNomineeCelebrityBtn = document.getElementById('add-nominee-celebrity-btn');

// Movies Management specific elements
const moviesTableBody = document.querySelector('#movies-table tbody');
const addMovieBtn = document.getElementById('add-movie-btn');
const movieSearchInput = document.getElementById('movie-search-input');
const movieSearchBtn = document.getElementById('movie-search-btn');

// Celebrity Management specific elements
const celebritiesTableBody = document.querySelector('#celebrities-table tbody');
const addCelebrityBtn = document.getElementById('add-celebrity-btn');
const celebritySearchInput = document.getElementById('celebrity-search-input');
const celebritySearchBtn = document.getElementById('celebrity-search-btn');

// Content Management specific elements (News & Blogs)
const newsTableBody = document.querySelector('#news-table tbody');
const blogsTableBody = document.querySelector('#blogs-table tbody');
const showNewsBtn = document.getElementById('show-news-btn');
const showBlogsBtn = document.getElementById('show-blogs-btn');
const addNewsBtn = document.getElementById('add-news-btn');
const addBlogBtn = document.getElementById('add-blog-btn');
const newsSection = document.getElementById('news-section');
const blogsSection = document.getElementById('blogs-section');

// Awards Management specific elements
const adminAwardsIndustrySelector = document.getElementById('admin-awards-industry-selector');
const adminAwardsContent = document.getElementById('admin-awards-content');
const adminNoIndustrySelected = document.getElementById('admin-no-industry-selected');
const categoriesSection = document.getElementById('categories-section');
const nomineesSection = document.getElementById('nominees-section');
const categoriesTableBody = document.querySelector('#categories-table tbody');
const addCategoryBtn = document.getElementById('add-category-btn');
const currentCategoryNameSpan = document.getElementById('current-category-name');
const nomineesTableBody = document.querySelector('#nominees-table tbody');
const addNomineeBtn = document.getElementById('add-nominee-btn');
const backToCategoriesBtn = document.getElementById('back-to-categories-btn');
let selectedNomineeMovie = null;
const nomineeMovieSuggestionsDiv = document.getElementById('nominee-movie-suggestions');
const nomineeMovieInput = document.getElementById('nominee-movie-search-input');
const nomineeMovieTitleField = document.getElementById('nominee-movie-title');
let searchNomineeMovieTimeout;

// User Management specific elements
const usersTableBody = document.querySelector('#users-table tbody');
const userSearchInput = document.getElementById('user-search-input');
const userSearchBtn = document.getElementById('user-search-btn');

// Moderation specific elements
const reviewsModerationTableBody = document.querySelector('#reviews-moderation-table tbody');
const commentsModerationTableBody = document.querySelector('#comments-moderation-table tbody');
const showReviewsModerationBtn = document.getElementById('show-reviews-moderation-btn');
const showCommentsModerationBtn = document.getElementById('show-comments-moderation-btn');
const movieReviewsModerationSection = document.getElementById('movie-reviews-moderation-section');
const commentsModerationSection = document.getElementById('comments-moderation-section');

// Settings specific elements
const retentionPeriodInput = document.getElementById('retention-period');
const saveRetentionBtn = document.getElementById('save-retention-btn');
const triggerCleanupBtn = document.getElementById('trigger-cleanup-btn');
const cleanupStatus = document.getElementById('cleanup-status');

// --- Global state variables for modals and active items ---
let currentEditItemId = null;
let currentNomineeCategoryId = null;
let selectedCastMembers = []; // Stores an array of {id: string, name: string} for the current movie being edited/added
let selectedNomineeCelebrity = null; // Stores {id: string, name: string, imageUrl: string} for the nominee form

// --- Utility Functions (for dashboard specific operations) ---
// --- Polling Management ---
const pollsTableBody = document.querySelector('#polls-table tbody');
const addPollBtn = document.getElementById('add-poll-btn');
const pollFormModal = document.getElementById('poll-form-modal');
const pollForm = document.getElementById('poll-form');
const pollModalTitle = document.getElementById('poll-modal-title');
const pollQuestionInput = document.getElementById('poll-question');
const pollStartTimeInput = document.getElementById('poll-start-time');
const pollEndTimeInput = document.getElementById('poll-end-time');
const cancelPollBtn = document.getElementById('cancel-poll-btn');
const pollOptionsContainer = document.getElementById('poll-options-container');
const addOptionBtn = document.getElementById('add-option-btn');

let currentPollId = null;
let optionIndex = 0;

// ===== IMAGE CROPPER STATE =====
// ===== IMAGE CROPPER STATE =====
let cropper = null;
let cropTargetType = null; // 'news' or 'blog'

// Normal thumbnail crops
let croppedNewsImageBlob = null;
let croppedBlogImageBlob = null;

// Banner crops
let croppedNewsBannerBlob = null;
let croppedBlogBannerBlob = null;


const imageCropModal = document.getElementById('image-crop-modal');
const cropperImageEl = document.getElementById('cropper-image');
const applyCropBtn = document.getElementById('apply-crop-btn');
const cancelCropBtn = document.getElementById('cancel-crop-btn');
const cropModalCloseBtn = document.getElementById('crop-modal-close');
const cropPreviewCanvas = document.getElementById('crop-preview-canvas');
const currentNewsBannerPreview = document.getElementById('current-news-banner-preview');
const currentBlogBannerPreview = document.getElementById('current-blog-banner-preview');

// open crop modal and create Cropper instance from a File or dataURL
function openCropModalFromFile(file, targetType, aspectRatio = 16 / 7) {
  cropTargetType = targetType; // 'news' or 'blog'
  const reader = new FileReader();
  reader.onload = () => {
    cropperImageEl.src = reader.result;
    // show modal
    imageCropModal.style.display = 'flex';
    // destroy previous cropper if any
    if (cropper) { try { cropper.destroy(); } catch(e){} cropper = null; }
    // init cropper after small timeout to ensure image loaded
    setTimeout(() => {
      cropper = new Cropper(cropperImageEl, {
        aspectRatio: aspectRatio,
        viewMode: 1,
        autoCropArea: 1,
        responsive: true,
        background: false,
        ready() {
          updateCropPreview();
        },
        crop() {
          updateCropPreview();
        }
      });
    }, 50);
  };
  reader.readAsDataURL(file);
}

function updateCropPreview() {
  if (!cropper) return;
  const canvas = cropper.getCroppedCanvas({
    width: 1600, // generate a high-res preview; change as needed
    height: Math.round(1600 / (16/7))
  });
  if (!canvas) return;
  // show preview in the small canvas
  const previewCtx = cropPreviewCanvas.getContext('2d');
  cropPreviewCanvas.width = canvas.width;
  cropPreviewCanvas.height = canvas.height;
  previewCtx.clearRect(0, 0, cropPreviewCanvas.width, cropPreviewCanvas.height);
  previewCtx.drawImage(canvas, 0, 0);
}

// Helper to set preview <img> from a blob and revoke previous blob URLs
function setPreviewImgFromBlob(previewImgEl, blob) {
  try {
    if (!previewImgEl) return;
    // Revoke previous blob URL if present
    if (previewImgEl.src && previewImgEl.src.startsWith('blob:')) {
      try { URL.revokeObjectURL(previewImgEl.src); } catch (e) { /* ignore */ }
    }
  } catch (e) { /* ignore */ }

  const previewUrl = URL.createObjectURL(blob);
  previewImgEl.src = previewUrl;
  previewImgEl.style.display = 'block';
}

// Apply crop, store the blob, update preview, then close modal
async function applyCropAndClose() {
  if (!cropper) {
    closeCropModal();
    return;
  }

  // Export blob from cropper (handle possible null)
  const blob = await new Promise((resolve) => {
    try {
      const canvas = cropper.getCroppedCanvas();
      if (!canvas) return resolve(null);
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.88);
    } catch (err) {
      console.error('Error exporting cropped canvas:', err);
      return resolve(null);
    }
  });

  if (!blob) {
    // Nothing exported — just close modal
    closeCropModal();
    return;
  }

  if (cropTargetType === 'news') {
  croppedNewsImageBlob = blob;
  setPreviewImgFromBlob(currentNewsImagePreview, blob);
} else if (cropTargetType === 'news-banner') {
  croppedNewsBannerBlob = blob;
  setPreviewImgFromBlob(currentNewsBannerPreview, blob);
} else if (cropTargetType === 'blog') {
  croppedBlogImageBlob = blob;
  setPreviewImgFromBlob(currentBlogImagePreview, blob);
} else if (cropTargetType === 'blog-banner') {
  croppedBlogBannerBlob = blob;
  setPreviewImgFromBlob(currentBlogBannerPreview, blob);
}

  closeCropModal();
}

// Close modal, destroy cropper, revoke modal image blob URL, clear preview canvas
function closeCropModal() {
  try {
    if (cropper) {
      try { cropper.destroy(); } catch (e) { /* ignore */ }
      cropper = null;
    }
  } catch (e) { /* ignore */ }

  // Reset target
  cropTargetType = null;

  // Hide modal if element exists
  if (imageCropModal) imageCropModal.style.display = 'none';

  // Revoke modal image src if it's a blob URL
  try {
    if (cropperImageEl && cropperImageEl.src && cropperImageEl.src.startsWith('blob:')) {
      try { URL.revokeObjectURL(cropperImageEl.src); } catch (e) { /* ignore */ }
    }
  } catch (e) { /* ignore */ }

  if (cropperImageEl) cropperImageEl.src = '';

  // Clear preview canvas safely
  try {
    if (cropPreviewCanvas && cropPreviewCanvas.getContext) {
      const ctx = cropPreviewCanvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, cropPreviewCanvas.width || 0, cropPreviewCanvas.height || 0);
    }
  } catch (e) { /* ignore */ }
}

// Modal button events (defensive)
if (applyCropBtn) applyCropBtn.addEventListener('click', applyCropAndClose);
if (cancelCropBtn) cancelCropBtn.addEventListener('click', closeCropModal);
if (cropModalCloseBtn) cropModalCloseBtn.addEventListener('click', closeCropModal);

// Close modal on outside click
if (imageCropModal) {
  imageCropModal.addEventListener('click', (e) => {
    if (e.target === imageCropModal) closeCropModal();
  });
}

// ===== Hook file inputs to open crop modal =====
const newsBannerInput = document.getElementById('news-banner-image');
const blogBannerInput = document.getElementById('blog-banner-image');

if (newsBannerInput) {
  newsBannerInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // clear previous banner blob
    croppedNewsBannerBlob = null;
    // open cropper with banner aspect ratio (16/7 recommended)
    openCropModalFromFile(file, 'news-banner', 16 / 7);
  });
}

if (blogBannerInput) {
  blogBannerInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    croppedBlogBannerBlob = null;
    openCropModalFromFile(file, 'blog-banner', 16 / 7);
  });
}


// --- Helper: Add "Other option needed?" checkbox ---
function addOtherOptionCheckbox() {
  if (document.getElementById('other-option-needed-label')) return;

  const label = document.createElement('label');
  label.id = 'other-option-needed-label';
  label.style.display = 'block';
  label.style.marginTop = '10px';
  label.innerHTML = `
    <input type="checkbox" id="other-option-needed" style="margin-right:5px;"> Other option needed?
  `;
  pollOptionsContainer.parentNode.appendChild(label);
}

// --- Load polls for admin dashboard ---
const loadPollsForAdmin = async () => {
  if (!pollsTableBody) return;

  pollsTableBody.innerHTML = '<tr><td colspan="4" class="text-center">Loading polls...</td></tr>';

  try {
    const q = query(collection(db, `artifacts/${appId}/polls`), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    pollsTableBody.innerHTML = '';

    if (snap.empty) {
      pollsTableBody.innerHTML = '<tr><td colspan="4" class="text-center">No polls added yet.</td></tr>';
      return;
    }

    snap.forEach(docSnap => {
      const poll = docSnap.data();
      const row = pollsTableBody.insertRow();
      const optionTexts = (poll.options || []).map(opt => opt.text).join(', ');

      row.innerHTML = `
        <td>${poll.question}</td>
        <td>${optionTexts}</td>
        <td>${poll.startTime?.toDate().toLocaleString()} – ${poll.endTime?.toDate().toLocaleString()}</td>
        <td class="actions-buttons">
          <button class="edit-poll-btn btn primary btn-small" data-id="${docSnap.id}">Edit</button>
          <button class="delete-poll-btn btn danger btn-small" data-id="${docSnap.id}">Delete</button>
        </td>
      `;
    });

    pollsTableBody.querySelectorAll('.edit-poll-btn').forEach(btn =>
      btn.addEventListener('click', e => openEditPollModal(e.target.dataset.id))
    );
    pollsTableBody.querySelectorAll('.delete-poll-btn').forEach(btn =>
      btn.addEventListener('click', e => confirmDeletePoll(e.target.dataset.id))
    );

  } catch (error) {
    console.error("Error loading polls:", error);
    showToast("Failed to load polls.", "error");
  }
};

// --- Open Add Poll Modal ---
const openAddPollModal = () => {
  pollForm.reset();
  pollOptionsContainer.innerHTML = '';
  optionIndex = 0;
  currentPollId = null;
  pollModalTitle.textContent = 'Add New Poll';
  addOtherOptionCheckbox();
  document.getElementById('other-option-needed').checked = false;
  pollFormModal.style.display = 'flex';
};

// --- Open Edit Poll Modal ---
const openEditPollModal = async (pollId) => {
  try {
    const docRef = doc(db, `artifacts/${appId}/polls`, pollId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("Poll not found");

    const data = docSnap.data();
    currentPollId = pollId;
    optionIndex = 0;

    pollModalTitle.textContent = 'Edit Poll';
    pollQuestionInput.value = data.question || '';
    pollStartTimeInput.value = data.startTime?.toDate().toISOString().slice(0, 16) || '';
    pollEndTimeInput.value = data.endTime?.toDate().toISOString().slice(0, 16) || '';
    pollOptionsContainer.innerHTML = '';

    (data.options || []).forEach(opt => {
      if (!opt.isOther) addPollOption(opt.text, opt.imageUrl);
    });

    addOtherOptionCheckbox();
    const otherNeeded = data.options?.some(opt => opt.isOther);
    document.getElementById('other-option-needed').checked = otherNeeded;

    pollFormModal.style.display = 'flex';
  } catch (error) {
    console.error("Error loading poll:", error);
    showToast("Failed to load poll.", "error");
  }
};

// --- Add a poll option (normal options only) ---
function addPollOption(text = '', imageUrl = '') {
  const wrapper = document.createElement('div');
  wrapper.className = 'poll-option-wrapper';
  wrapper.style.marginBottom = '10px';

  wrapper.innerHTML = `
    <input type="text" name="option-text-${optionIndex}" placeholder="Option Text" value="${text}" required style="width: 60%; margin-right: 5px;" />
    <input type="file" name="option-image-${optionIndex}" accept="image/*" />
    ${imageUrl ? `<img src="${imageUrl}" style="height:30px; margin-left:5px;" />` : ''}
    <button type="button" class="remove-option-btn btn danger btn-sm" style="margin-left: 5px;">Remove</button>
  `;

  wrapper.querySelector('.remove-option-btn').addEventListener('click', () => {
    pollOptionsContainer.removeChild(wrapper);
  });

  pollOptionsContainer.appendChild(wrapper);
  optionIndex++;
}

// --- Handle poll form submit ---
const handlePollFormSubmit = async (e) => {
  e.preventDefault();

  const question = pollQuestionInput.value.trim();
  const startTime = pollStartTimeInput.value ? Timestamp.fromDate(new Date(pollStartTimeInput.value)) : null;
  const endTime = pollEndTimeInput.value ? Timestamp.fromDate(new Date(pollEndTimeInput.value)) : null;

  const optionWrappers = pollOptionsContainer.querySelectorAll('.poll-option-wrapper');
  const options = [];

  for (const [index, wrapper] of Array.from(optionWrappers).entries()) {
    const textInput = wrapper.querySelector('input[type="text"]');
    const fileInput = wrapper.querySelector('input[type="file"]');

    if (!textInput.value.trim()) continue;

    let imageUrl = '';
    if (fileInput.files[0]) {
      const file = fileInput.files[0];
      const storageRef = ref(storage, `poll-options/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      imageUrl = await getDownloadURL(storageRef);
    }

    options.push({
      text: textInput.value.trim(),
      imageUrl: imageUrl || null,
      isOther: false
    });
  }

  // Check "Other option needed"
  const otherNeeded = document.getElementById('other-option-needed').checked;
  if (otherNeeded) {
    options.push({ text: 'Other', imageUrl: null, isOther: true });
  }

  if (!question || options.length < 2 || !startTime || !endTime) {
    showToast("Please fill all fields with at least 2 options.", "warning");
    return;
  }

  const pollData = {
    question,
    options,
    startTime,
    endTime,
    createdAt: currentPollId
      ? (await getDoc(doc(db, `artifacts/${appId}/polls`, currentPollId))).data().createdAt
      : Timestamp.now()
  };

  try {
    if (currentPollId) {
      await updateDoc(doc(db, `artifacts/${appId}/polls`, currentPollId), pollData);
      showToast("Poll updated successfully!", "success");
    } else {
      await addDoc(collection(db, `artifacts/${appId}/polls`), pollData);
      showToast("Poll added successfully!", "success");
    }

    pollFormModal.style.display = 'none';
    loadPollsForAdmin();
  } catch (error) {
    console.error("Error saving poll:", error);
    showToast("Failed to save poll.", "error");
  }
};

// --- Delete poll ---
const confirmDeletePoll = (pollId) => {
  showCustomModal("Are you sure you want to delete this poll?", async () => {
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/polls`, pollId));
      showToast("Poll deleted successfully.", "success");
      loadPollsForAdmin();
    } catch (error) {
      console.error("Error deleting poll:", error);
      showToast("Failed to delete poll.", "error");
    }
  });
};

// --- Event Listeners ---
if (addPollBtn) addPollBtn.addEventListener('click', openAddPollModal);
if (pollForm) pollForm.addEventListener('submit', handlePollFormSubmit);
if (cancelPollBtn) cancelPollBtn.addEventListener('click', () => {
  pollFormModal.style.display = 'none';
});
if (addOptionBtn) addOptionBtn.addEventListener('click', () => addPollOption());


/**
 * Handles tab switching in the dashboard.
 * This function is called when a sidebar navigation item is clicked,
 * and updates the active tab content display.
 * @param {Event} event The click event object.
 */
const switchTab = (event) => {
    const tabElement = event.target.closest('[data-tab]');
    if (!tabElement) return;

    const targetTab = tabElement.dataset.tab;

    sidebarNav.querySelectorAll('li').forEach(item => item.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    tabElement.classList.add('active');
    document.getElementById(targetTab)?.classList.add('active');

    switch (targetTab) {
        case 'movies-management':
            loadMoviesForAdmin();
            break;
        case 'celebrity-management':
            loadCelebritiesForAdmin();
            break;
        case 'content-management':
            showNewsSection();
            loadNewsForAdmin();
            break;
        case 'polling-management':
            loadPollsForAdmin();
            break;
        case 'awards-management':
            adminAwardsIndustrySelector.value = '';
            adminAwardsContent.style.display = 'block';
            adminNoIndustrySelected.style.display = 'block';
            categoriesSection.style.display = 'none';
            nomineesSection.style.display = 'none';
            clearAllAwardForms();
            break;
        case 'user-management':
            loadUsers();
            break;
        case 'moderation':
            showReviewsModerationSection();
            loadReviewsForModeration();
            break;
        case 'feedback-management':
            loadFeedbackEntries();
            break;
        case 'promotion-inquiries':
            loadPromotionInquiries();
            break;
        case 'settings':
            loadSettings();
            break;
    }
};


/**
 * Uploads an image file to Firebase Storage.
 * Creates a unique filename using a timestamp.
 * @param {File} file The image file to upload.
 * @param {string} path The storage bucket path (e.g., 'movie_posters/', 'news_images/').
 * @param {string} fileName The desired base filename (e.g., 'poster.jpg').
 * @returns {Promise<string|null>} A Promise that resolves with the public download URL of the uploaded image, or null if no file.
 */
const uploadImage = async (file, path, fileName) => {
    if (!file) return null;

    const uniqueFileName = `${Date.now()}_${fileName}`;
    const storageRef = ref(storage, `${path}${uniqueFileName}`);

    try {
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        showToast('Image uploaded successfully!', 'success');
        return downloadURL;
    } catch (error) {
        console.error("Error uploading image:", error);
        showToast(`Image upload failed: ${error.message}`, 'error');
        return null;
    }
};

/**
 * Deletes an image from Firebase Storage using its download URL.
 * Extracts the storage reference from the URL.
 * @param {string} url The public download URL of the image to delete.
 */
const deleteImage = async (url) => {
    if (!url) return;
    try {
        const imageRef = ref(storage, url);
        await deleteObject(imageRef);
        console.log("Image deleted from storage:", url);
    } catch (error) {
        console.warn("Error deleting image from storage (it might not exist or URL is invalid):", error);
    }
};

// --- Movies Management Functions ---

/**
 * Loads and displays all movies in the admin dashboard table.
 * Orders them by creation date, newest first.
 * @param {string} searchTerm Optional term to search by title, genre, or industry.
 */
const loadMoviesForAdmin = async (searchTerm = '') => {
    if (!moviesTableBody) return;

    moviesTableBody.innerHTML = '<tr><td colspan="10" class="text-center">Loading movies...</td></tr>';
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    try {
        const moviesRef = collection(db, `artifacts/${appId}/movies`);
        const q = query(moviesRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);

        moviesTableBody.innerHTML = '';

        if (querySnapshot.empty) {
            moviesTableBody.innerHTML = '<tr><td colspan="10" class="text-center">No movies added yet.</td></tr>';
            return;
        }

        const filteredMovies = [];
        querySnapshot.forEach((docSnap) => {
            const movie = docSnap.data();
            const movieId = docSnap.id;

            const matchesSearch = !lowerCaseSearchTerm ||
                (movie.title && movie.title.toLowerCase().includes(lowerCaseSearchTerm)) ||
                (movie.genre && movie.genre.some(g => g.toLowerCase().includes(lowerCaseSearchTerm))) ||
                (movie.industry && movie.industry.toLowerCase().includes(lowerCaseSearchTerm));

            if (matchesSearch) {
                filteredMovies.push({ id: movieId, ...movie });
            }
        });

        if (filteredMovies.length === 0) {
            moviesTableBody.innerHTML = '<tr><td colspan="10" class="text-center">No movies found matching your search.</td></tr>';
            return;
        }

        filteredMovies.forEach((movie) => {
            const row = moviesTableBody.insertRow();
            row.dataset.movieId = movie.id;

            const isPublished = movie.scheduledAt && movie.scheduledAt.toDate() <= new Date();
            const publishedStatusHtml = isPublished
                ? '<span class="status-active">Yes</span>'
                : '<span class="status-inactive">No</span>';

            // ✅ Use ottPlatforms array to determine OTT published status
            const isOttPublished = Array.isArray(movie.ottPlatforms) && movie.ottPlatforms.length > 0;
            const ottPublishedHtml = isOttPublished
                ? '<span class="status-active">Yes</span>'
                : '<span class="status-inactive">No</span>';

            row.innerHTML = `
                <td><img src="${movie.posterUrl || 'https://placehold.co/60x90/333/eee?text=No+Poster'}" alt="${movie.title}" class="table-img" onerror="this.onerror=null;this.src='https://placehold.co/60x90/333/eee?text=No+Poster';"></td>
                <td>${movie.title}</td>
                <td>${movie.genre ? movie.genre.join(', ') : 'N/A'}</td>
                <td>${movie.industry || 'N/A'}</td>
                <td>${movie.releaseDate ? formatDate(movie.releaseDate) : 'N/A'}</td>
                <td>${ottPublishedHtml}</td>
                <td>${movie.isPopular ? '<span class="status-active">Yes</span>' : '<span class="status-inactive">No</span>'}</td>
                <td>${movie.isTopBoxOffice ? '<span class="status-active">Yes</span>' : '<span class="status-inactive">No</span>'}</td>
                <td>${publishedStatusHtml}</td>
                <td class="actions-buttons">
                    <button class="edit-movie-btn btn primary btn-small" data-movie-id="${movie.id}">Edit</button>
                    <button class="delete-movie-btn btn danger btn-small" data-movie-id="${movie.id}">Delete</button>
                </td>
            `;
        });

        // Event listeners
        moviesTableBody.querySelectorAll('.edit-movie-btn').forEach(button => {
            button.addEventListener('click', (event) => editMovie(event.target.dataset.movieId));
        });
        moviesTableBody.querySelectorAll('.delete-movie-btn').forEach(button => {
            button.addEventListener('click', (event) => confirmDeleteMovie(event.target.dataset.movieId));
        });

    } catch (error) {
        console.error("Error loading movies for admin:", error);
        showToast('Failed to load movies for admin. Please try again.', 'error');
        moviesTableBody.innerHTML = '<tr><td colspan="10" class="text-center">Error loading movies.</td></tr>';
    }
};


/**
 * Opens the movie form modal for adding a new movie.
 * Resets the form and modal title, and clears cast selection.
 */
const addMovie = () => {
    movieForm.reset();
    currentEditItemId = null;
    movieModalTitle.textContent = 'Add New Movie';

    // Reset poster
    document.getElementById('movie-poster').value = '';
    currentMoviePosterPreview.style.display = 'none';
    currentMoviePosterPreview.src = '';

    // Reset scheduled time
    document.getElementById('movie-scheduled-time').value = '';

    // Reset boolean toggles
    movieIsPopularCheckbox.checked = false;
    movieIsTopBoxOfficeCheckbox.checked = false;

    // Reset selected cast
    selectedCastMembers = [];
    renderSelectedCast();
    movieCastInput.value = '';
    celebritySuggestionsDiv.style.display = 'none';

    // ✅ Reset OTT platforms
    selectedOttPlatforms = [];
    document.getElementById('movie-ott-platforms').value = '';
    document.querySelectorAll('.ott-platform').forEach(img => {
        img.classList.remove('selected');
    });

    // Show modal
    movieFormModal.style.display = 'flex';
};


/**
 * Opens the movie form modal for editing an existing movie.
 * Fetches movie data and populates the form fields, including new flags and cast.
 * @param {string} movieId The ID of the movie to edit.
 */
const editMovie = async (movieId) => {
    try {
        const movieDocRef = doc(db, `artifacts/${appId}/movies`, movieId);
        const movieDocSnap = await getDoc(movieDocRef);

        if (!movieDocSnap.exists()) {
            showToast('Movie not found for editing.', 'error');
            return;
        }

        const movie = movieDocSnap.data();
        currentEditItemId = movieId;
        movieModalTitle.textContent = 'Edit Movie';

        document.getElementById('movie-title').value = movie.title || '';
        document.getElementById('movie-genre').value = movie.genre ? movie.genre.join(', ') : '';
        document.getElementById('movie-industry').value = movie.industry || '';
        document.getElementById('movie-release-date').value =
            movie.releaseDate ? movie.releaseDate.toDate().toISOString().split('T')[0] : '';
        document.getElementById('movie-description').value = movie.description || '';
        document.getElementById('movie-trailer-link').value = movie.trailerLink || '';

        document.getElementById('movie-scheduled-time').value =
            movie.scheduledAt ? movie.scheduledAt.toDate().toISOString().slice(0, 16) : '';

        movieIsPopularCheckbox.checked = movie.isPopular || false;
        movieIsTopBoxOfficeCheckbox.checked = movie.isTopBoxOffice || false;

        // ✅ Load OTT platforms
        selectedOttPlatforms = Array.isArray(movie.ottPlatforms) ? movie.ottPlatforms : [];
        document.getElementById('movie-ott-platforms').value = JSON.stringify(selectedOttPlatforms);

        // Update OTT logo selections
        document.querySelectorAll('.ott-platform').forEach(img => {
            if (selectedOttPlatforms.includes(img.alt)) {
                img.classList.add('selected');
            } else {
                img.classList.remove('selected');
            }
        });

        // Load poster preview
        if (movie.posterUrl) {
            currentMoviePosterPreview.src = movie.posterUrl;
            currentMoviePosterPreview.style.display = 'block';
        } else {
            currentMoviePosterPreview.src = '';
            currentMoviePosterPreview.style.display = 'none';
        }
        document.getElementById('movie-poster').value = '';

        // ✅ Load cast members
        selectedCastMembers = Array.isArray(movie.cast)
            ? movie.cast.map(member =>
                typeof member === 'object' && member.id && member.name
                    ? { id: member.id, name: member.name }
                    : { id: '', name: String(member) }
              )
            : [];

        renderSelectedCast();
        movieCastInput.value = '';
        celebritySuggestionsDiv.style.display = 'none';

        movieFormModal.style.display = 'flex';
    } catch (error) {
        console.error("Error editing movie:", error);
        showToast(`Failed to load movie for editing: ${error.message}`, 'error');
    }
};


/**
 * Handles the submission of the movie form (for both adding new movies and editing existing ones).
 * Uploads poster image to Storage if a new file is selected.
 * @param {Event} event The form submission event.
 */
const handleMovieFormSubmit = async (event) => {
    event.preventDefault();

    const title = document.getElementById('movie-title').value.trim();

    // Multiple genres
    const genre = document.getElementById('movie-genre').value
        .split(',')
        .map(g => g.trim())
        .filter(g => g);

    // Multiple industries
    const industrySelect = document.getElementById('movie-industry');
    const industry = Array.from(industrySelect.selectedOptions).map(option => option.value);

    const releaseDateInput = document.getElementById('movie-release-date').value;
    const description = document.getElementById('movie-description').value.trim();
    const posterFile = document.getElementById('movie-poster').files[0];
    const trailerLink = document.getElementById('movie-trailer-link').value.trim();
    const scheduledInput = document.getElementById('movie-scheduled-time');
    const ottPlatformsSelected = JSON.parse(document.getElementById('movie-ott-platforms').value || '[]');
    const ottPublished = ottPlatformsSelected.length > 0;

    if (!title || industry.length === 0 || !releaseDateInput || !description || !scheduledInput.value) {
        showToast('Please fill in all required movie fields, including selecting at least one industry and a scheduled publish time.', 'warning');
        return;
    }

    let scheduledAt = Timestamp.fromDate(new Date(scheduledInput.value));
    let posterUrl = null;

    try {
        // Use existing preview if no new file selected
        if (currentMoviePosterPreview.src && currentMoviePosterPreview.style.display !== 'none') {
            posterUrl = currentMoviePosterPreview.src;
        }

        // If user selected a new file
        if (posterFile) {
            const fileName = `${Date.now()}_${posterFile.name}`;

            // Delete old poster if editing
            if (currentEditItemId && posterUrl && posterUrl.includes('moviereporter.in/uploads/')) {
                await deleteImageFromHostinger(posterUrl);
            }

            // Upload new poster
            const uploadedUrl = await uploadImageToHostinger(posterFile, fileName);
            if (!uploadedUrl) {
                showToast('Failed to upload poster image to Hostinger.', 'error');
                return;
            }

            posterUrl = uploadedUrl;
        }

        if (!posterUrl) {
            showToast('Please upload a movie poster.', 'warning');
            return;
        }

        const dateObj = new Date(releaseDateInput);
        if (isNaN(dateObj.getTime())) {
            showToast('Invalid Release Date format.', 'error');
            return;
        }

        const releaseDateTimestamp = Timestamp.fromDate(dateObj);
        const castIds = (selectedCastMembers || []).map(c => c.id);

        const movieData = {
            title,
            genre,
            industry,
            releaseDate: releaseDateTimestamp,
            description,
            posterUrl,
            scheduledAt,
            ottPublished,
            ottPlatforms: ottPlatformsSelected,
            isPopular: movieIsPopularCheckbox.checked,
            isTopBoxOffice: movieIsTopBoxOfficeCheckbox.checked,
            trailerLink,
            cast: selectedCastMembers,
            castIds,
            createdAt: currentEditItemId
                ? (await getDoc(doc(db, `artifacts/${appId}/movies`, currentEditItemId))).data().createdAt
                : Timestamp.now(),
        };

        if (currentEditItemId) {
            await updateDoc(doc(db, `artifacts/${appId}/movies`, currentEditItemId), movieData);
            showToast('Movie updated successfully!', 'success');
        } else {
            await addDoc(collection(db, `artifacts/${appId}/movies`), movieData);
            showToast('Movie added successfully!', 'success');
        }

        movieFormModal.style.display = 'none';
        loadMoviesForAdmin();
    } catch (error) {
        console.error("Error saving movie:", error);
        showToast(`Failed to save movie: ${error.message}`, 'error');
    }
};

// OTT selection logic (unchanged)
const ottInput = document.getElementById('movie-ott-platforms');
const ottImages = document.querySelectorAll('.ott-platform');
let selectedOttPlatforms = [];

ottImages.forEach(img => {
    img.addEventListener('click', () => {
        const platform = img.alt;
        if (selectedOttPlatforms.includes(platform)) {
            selectedOttPlatforms = selectedOttPlatforms.filter(p => p !== platform);
            img.classList.remove('selected');
        } else {
            selectedOttPlatforms.push(platform);
            img.classList.add('selected');
        }
        ottInput.value = JSON.stringify(selectedOttPlatforms);
    });
});



/**
 * Confirms and deletes a movie.
 * @param {string} movieId The ID of the movie to delete.
 */
const confirmDeleteMovie = (movieId) => {
    showCustomModal('Are you sure you want to delete this movie? This will also delete its poster, associated reviews, and user votes for it.', async () => {
        try {
            await runTransaction(db, async (transaction) => {
                const movieDocRef = doc(db, `artifacts/${appId}/movies`, movieId);
                const movieDocSnap = await transaction.get(movieDocRef);

                if (!movieDocSnap.exists()) {
                    throw new Error("Movie not found for deletion.");
                }

                const movieData = movieDocSnap.data();

                // ✅ Delete poster from Hostinger if URL matches
                const posterUrl = movieData.posterUrl;
                if (posterUrl && posterUrl.includes('moviereporter.in/uploads/')) {
                    await deleteImageFromHostinger(posterUrl);
                }

                // ✅ Delete all reviews for this movie
                const reviewsQuery = query(
                    collection(db, `artifacts/${appId}/reviews`),
                    where('movieId', '==', movieId)
                );
                const reviewSnapshots = await getDocs(reviewsQuery);

                for (const reviewDocSnap of reviewSnapshots.docs) {
                    const reviewId = reviewDocSnap.id;
                    const userId = reviewDocSnap.data().userId;

                    transaction.delete(doc(db, `artifacts/${appId}/reviews`, reviewId));

                    if (userId) {
                        transaction.delete(doc(db, `artifacts/${appId}/users/${userId}/userReviews`, reviewId));
                    }
                }

                // ✅ Finally delete the movie
                transaction.delete(movieDocRef);
            });

            showToast('Movie deleted successfully!', 'success');
            loadMoviesForAdmin();
        } catch (error) {
            console.error("Error deleting movie:", error);
            showToast(`Failed to delete movie: ${error.message}`, 'error');
        }
    });
};


// --- Cast Management for Movies ---

/**
 * Renders the currently selected cast members as tags in the UI.
 */
const renderSelectedCast = () => {
    if (!selectedCastDisplay) return;

    selectedCastDisplay.innerHTML = '';
    selectedCastMembers.forEach((member, index) => {
        const tag = document.createElement('span');
        tag.classList.add('cast-tag');
        tag.innerHTML = `
            ${member.name}
            <button type="button" class="remove-tag" data-index="${index}">&times;</button>
        `;
        selectedCastDisplay.appendChild(tag);
    });

    movieCastDataHiddenInput.value = JSON.stringify(selectedCastMembers);

    selectedCastDisplay.querySelectorAll('.remove-tag').forEach(button => {
        button.addEventListener('click', (event) => {
            const indexToRemove = parseInt(event.target.dataset.index);
            removeCastMember(indexToRemove);
        });
    });
};

/**
 * Adds a cast member to the selected list.
 * @param {{id: string, name: string}} celebrity The celebrity object to add.
 */
const addCastMember = (celebrity) => {
    if (selectedCastMembers.some(member => member.id === celebrity.id)) {
        showToast(`${celebrity.name} is already in the cast.`, 'info');
        return;
    }
    selectedCastMembers.push(celebrity);
    renderSelectedCast();
    movieCastInput.value = '';
    celebritySuggestionsDiv.style.display = 'none';
};

/**
 * Removes a cast member from the selected list by index.
 * @param {number} index The index of the cast member to remove.
 */
const removeCastMember = (index) => {
    selectedCastMembers.splice(index, 1);
    renderSelectedCast();
};

let searchMovieCastTimeout;
/**
 * Searches for celebrities based on user input and displays suggestions for movie cast.
 * @param {string} searchTerm The text to search for.
 */
const searchCelebrities = async (searchTerm) => {
    clearTimeout(searchMovieCastTimeout);
    celebritySuggestionsDiv.innerHTML = '';
    celebritySuggestionsDiv.style.display = 'none';

    if (searchTerm.trim().length < 2) return;

    searchMovieCastTimeout = setTimeout(async () => {
        try {
            const celebritiesRef = collection(db, `artifacts/${appId}/celebrities`);
            const q = query(celebritiesRef, orderBy('name')); // Fetch all in name order
            const querySnapshot = await getDocs(q);

            const allCelebrities = querySnapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().name || '',
                imageUrl: doc.data().imageUrl || '',
                role: doc.data().role || ''
            }));

            // Full includes() match, not just prefix
            const filteredSuggestions = allCelebrities
                .filter(celeb =>
                    celeb.name.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .slice(0, 10); // Limit to 10 suggestions shown

            renderCelebritySuggestions(filteredSuggestions);

        } catch (error) {
            console.error("Error searching celebrities for movie cast:", error);
            showToast('Failed to search celebrities.', 'error');
        }
    }, 300); // debounce
};


/**
 * Renders the search suggestions for movie cast in the dropdown.
 * @param {Array<Object>} suggestions An array of celebrity objects ({id, name, role, imageUrl}).
 */
const renderCelebritySuggestions = (suggestions) => {
    celebritySuggestionsDiv.innerHTML = '';
    if (suggestions.length === 0) {
        celebritySuggestionsDiv.style.display = 'none';
        return;
    }

    suggestions.forEach(celeb => {
        const suggestionItem = document.createElement('div');
        suggestionItem.classList.add('celebrity-suggestion-item');
        suggestionItem.innerHTML = `
            <img src="${celeb.imageUrl || 'https://placehold.co/30x30/333/eee?text=No'}" alt="${celeb.name}" class="rounded-full" style="width:30px; height:30px; object-fit:cover; margin-right: 10px;" onerror="this.onerror=null;this.src='https://placehold.co/30x30/333/eee?text=No';">
            <span>${celeb.name} <small>(${celeb.role || 'N/A'})</small></span>
        `;
        suggestionItem.addEventListener('click', () => {
            addCastMember({ id: celeb.id, name: celeb.name });
            movieCastInput.value = '';
            celebritySuggestionsDiv.style.display = 'none';
        });
        celebritySuggestionsDiv.appendChild(suggestionItem);
    });
    celebritySuggestionsDiv.style.display = 'block';
};


// --- Celebrity Management Functions ---

/**
 * Loads and displays all celebrities in the admin dashboard table.
 * Orders them by name.
 * @param {string} searchTerm Optional term to search by name, role, or description.
 */
let lastCelebrityDoc = null;
let isLoadingCelebrities = false;
const CELEBRITY_PAGE_SIZE = 10;

const loadCelebritiesForAdmin = async (searchTerm = '', append = false) => {
    if (!celebritiesTableBody || isLoadingCelebrities) return;

    isLoadingCelebrities = true;
    if (!append) {
        celebritiesTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading celebrities...</td></tr>';
        lastCelebrityDoc = null;
    }

    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    try {
        const celebritiesRef = collection(db, `artifacts/${appId}/celebrities`);
        let q = query(celebritiesRef, orderBy('name', 'asc'), limit(CELEBRITY_PAGE_SIZE));
        if (lastCelebrityDoc) {
            q = query(q, startAfter(lastCelebrityDoc));
        }

        const querySnapshot = await getDocs(q);
        if (!append) celebritiesTableBody.innerHTML = '';

        const filteredCelebrities = [];
        querySnapshot.forEach((docSnap) => {
            const celebrity = docSnap.data();
            const celebrityId = docSnap.id;

            const matchesSearch = !lowerCaseSearchTerm ||
                (celebrity.name && celebrity.name.toLowerCase().includes(lowerCaseSearchTerm)) ||
                (celebrity.role && celebrity.role.toLowerCase().includes(lowerCaseSearchTerm)) ||
                (celebrity.description && celebrity.description.toLowerCase().includes(lowerCaseSearchTerm));

            if (matchesSearch) {
                filteredCelebrities.push({ id: celebrityId, ...celebrity });
            }
        });

        if (filteredCelebrities.length === 0 && !append) {
            celebritiesTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No celebrities found.</td></tr>';
            document.getElementById('load-more-celebrities-btn')?.remove();
            return;
        }

        filteredCelebrities.forEach((celebrity) => {
            const row = celebritiesTableBody.insertRow();
            row.dataset.celebrityId = celebrity.id;

            row.innerHTML = `
                <td><img src="${celebrity.imageUrl || 'https://placehold.co/60x60/333/eee?text=Photo'}" alt="${celebrity.name}" class="table-img rounded-full" onerror="this.onerror=null;this.src='https://placehold.co/60x60/333/eee?text=Photo';"></td>
                <td>${celebrity.name}</td>
                <td>${celebrity.role || 'N/A'}</td>
                <td>
                    ${celebrity.description ? `<button class="btn small" onclick="viewMessageModal(
                        '${escapeHtmlAttributeString(`Description for ${celebrity.name}`)}',
                        \`${escapeHtmlAttributeString(celebrity.description)}\`,
                        '${escapeHtmlAttributeString(`Role: ${celebrity.role || 'N/A'}`)}'
                    )">View</button>` : 'N/A'}
                </td>
                <td class="actions-buttons">
                    <button class="edit-celebrity-btn btn primary btn-small" data-celebrity-id="${celebrity.id}">Edit</button>
                    <button class="delete-celebrity-btn btn danger btn-small" data-celebrity-id="${celebrity.id}">Delete</button>
                </td>
            `;
        });

        celebritiesTableBody.querySelectorAll('.edit-celebrity-btn').forEach(button => {
            button.addEventListener('click', (event) => editCelebrity(event.target.dataset.celebrityId));
        });
        celebritiesTableBody.querySelectorAll('.delete-celebrity-btn').forEach(button => {
            button.addEventListener('click', (event) => confirmDeleteCelebrity(event.target.dataset.celebrityId));
        });

        // Update last doc for next page
        lastCelebrityDoc = querySnapshot.docs[querySnapshot.docs.length - 1];

        // Show or hide "Load More" button
        if (querySnapshot.size === CELEBRITY_PAGE_SIZE) {
            if (!document.getElementById('load-more-celebrities-btn')) {
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.id = 'load-more-celebrities-btn';
                loadMoreBtn.className = 'btn small btn-primary';
                loadMoreBtn.textContent = 'Load More';
                loadMoreBtn.style.margin = '20px auto';
                loadMoreBtn.style.display = 'block';
                loadMoreBtn.onclick = () => loadCelebritiesForAdmin(searchTerm, true);
                celebritiesTableBody.parentElement.appendChild(loadMoreBtn);
            }
        } else {
            document.getElementById('load-more-celebrities-btn')?.remove();
        }

    } catch (error) {
        console.error("Error loading celebrities for admin:", error);
        showToast('Failed to load celebrities. Try again.', 'error');
        if (!append) {
            celebritiesTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Error loading data.</td></tr>';
        }
    } finally {
        isLoadingCelebrities = false;
    }
};


/**
 * Opens the celebrity form modal for adding a new celebrity.
 * Resets the form and modal title.
 */
const addCelebrity = () => {
    celebrityForm.reset();
    currentEditItemId = null;
    celebrityModalTitle.textContent = 'Add New Celebrity';
    document.getElementById('celebrity-image').value = '';
    currentCelebrityImagePreview.style.display = 'none';
    currentCelebrityImagePreview.src = '';
    celebrityFormModal.style.display = 'flex';
};

/**
 * Opens the celebrity form modal for editing an existing celebrity.
 * Fetches celebrity data and populates the form fields.
 * @param {string} celebrityId The ID of the celebrity to edit.
 */
const editCelebrity = async (celebrityId) => {
    try {
        const celebrityDocRef = doc(db, `artifacts/${appId}/celebrities`, celebrityId);
        const celebrityDocSnap = await getDoc(celebrityDocRef);

        if (!celebrityDocSnap.exists()) {
            showToast('Celebrity not found for editing.', 'error');
            return;
        }

        const celebrity = celebrityDocSnap.data();
        currentEditItemId = celebrityId;
        celebrityModalTitle.textContent = 'Edit Celebrity';

        document.getElementById('celebrity-name').value = celebrity.name || '';
        document.getElementById('celebrity-role').value = celebrity.role || '';
        document.getElementById('celebrity-description').value = celebrity.description || '';

        if (celebrity.imageUrl) {
            currentCelebrityImagePreview.src = celebrity.imageUrl;
            currentCelebrityImagePreview.style.display = 'block';
        } else {
            currentCelebrityImagePreview.style.display = 'none';
            currentCelebrityImagePreview.src = '';
        }
        document.getElementById('celebrity-image').value = '';

        celebrityFormModal.style.display = 'flex';
    } catch (error) {
        console.error("Error editing celebrity:", error);
        showToast(`Failed to load celebrity for editing: ${error.message}`, 'error');
    }
};

/**
 * Handles the submission of the celebrity form (for both adding new celebrities and editing existing ones).
 * Uploads image to Storage if a new file is selected.
 * @param {Event} event The form submission event.
 */
const handleCelebrityFormSubmit = async (event) => {
    event.preventDefault();

    const name = document.getElementById('celebrity-name').value.trim();
    const role = document.getElementById('celebrity-role').value.trim();
    const description = document.getElementById('celebrity-description').value.trim();
    const imageFile = document.getElementById('celebrity-image').files[0];

    if (!name) {
        showToast('Please provide a name for the celebrity.', 'warning');
        return;
    }

    try {
        let imageUrl = currentCelebrityImagePreview.src && currentCelebrityImagePreview.style.display !== 'none'
            ? currentCelebrityImagePreview.src
            : null;

        let oldImageUrl = imageUrl;

        // ✅ Upload new image if selected
        if (imageFile) {
            const fileName = `${Date.now()}_${imageFile.name}`;

            // ✅ Delete previous image if hosted on Hostinger
            if (currentEditItemId && oldImageUrl && oldImageUrl.includes('moviereporter.in/uploads/')) {
                await deleteImageFromHostinger(oldImageUrl);
            }

            imageUrl = await uploadImageToHostinger(imageFile, fileName);
            if (!imageUrl) {
                showToast('Failed to upload celebrity image.', 'error');
                return;
            }
        }

        const celebrityData = {
            name,
            role,
            description,
            imageUrl,
            createdAt: currentEditItemId
                ? (await getDoc(doc(db, `artifacts/${appId}/celebrities`, currentEditItemId))).data().createdAt
                : Timestamp.now()
        };

        if (currentEditItemId) {
            await updateDoc(doc(db, `artifacts/${appId}/celebrities`, currentEditItemId), celebrityData);
            showToast('Celebrity updated successfully!', 'success');
        } else {
            await addDoc(collection(db, `artifacts/${appId}/celebrities`), celebrityData);
            showToast('Celebrity added successfully!', 'success');
        }

        celebrityFormModal.style.display = 'none';
        loadCelebritiesForAdmin();
    } catch (error) {
        console.error("Error saving celebrity:", error);
        showToast(`Failed to save celebrity: ${error.message}`, 'error');
    }
};



/**
 * Confirms and deletes a celebrity and their associated data (image).
 * @param {string} celebrityId The ID of the celebrity to delete.
 */
const confirmDeleteCelebrity = (celebrityId) => {
    showCustomModal('Are you sure you want to delete this celebrity? This will also delete their profile image.', async () => {
        try {
            await runTransaction(db, async (transaction) => {
                const celebrityDocRef = doc(db, `artifacts/${appId}/celebrities`, celebrityId);
                const celebrityDocSnap = await transaction.get(celebrityDocRef);

                if (!celebrityDocSnap.exists()) {
                    throw new Error("Celebrity not found for deletion.");
                }

                const imageUrl = celebrityDocSnap.data().imageUrl;
                if (imageUrl && imageUrl.includes('moviereporter.in/uploads/')) {
                    await deleteImageFromHostinger(imageUrl);
                }

                transaction.delete(celebrityDocRef);
            });

            showToast('Celebrity deleted successfully!', 'success');
            loadCelebritiesForAdmin();
        }
        catch (error) {
            console.error("Error deleting celebrity:", error);
            showToast(`Failed to delete celebrity: ${error.message}`, 'error');
        }
    });
};

// --- Content Management Functions (News & Blogs) ---

/**
 * Shows the news section and loads news articles for admin.
 */
const showNewsSection = () => {
    newsSection.style.display = 'block';
    blogsSection.style.display = 'none';
    showNewsBtn.classList.add('active-toggle');
    showBlogsBtn.classList.remove('active-toggle');
    loadNewsForAdmin();
};

/**
 * Shows the blogs section and loads blog articles for admin.
 */
const showBlogsSection = () => {
    newsSection.style.display = 'none';
    blogsSection.style.display = 'block';
    showNewsBtn.classList.remove('active-toggle');
    showBlogsBtn.classList.add('active-toggle');
    loadBlogsForAdmin();
};

/**
 * Loads and displays news articles in the admin dashboard table.
 */
const loadNewsForAdmin = async () => {
    if (!newsTableBody) return;

    newsTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading news articles...</td></tr>';

    try {
        const newsRef = collection(db, `artifacts/${appId}/news`);
        const q = query(newsRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);

        newsTableBody.innerHTML = '';

        if (querySnapshot.empty) {
            newsTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No news articles added yet.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const article = docSnap.data();
            const articleId = docSnap.id;
            const row = newsTableBody.insertRow();
            row.dataset.articleId = articleId;

            const isPublished = article.scheduledAt && article.scheduledAt.toDate() <= new Date();
            const publishedStatusHtml = isPublished
                ? '<span class="status-active">Yes</span>'
                : '<span class="status-inactive">No</span>';

            row.innerHTML = `
                <td><img src="${article.imageUrl || 'https://placehold.co/80x50/333/eee?text=No+Image'}" alt="${article.title}" class="table-img" onerror="this.onerror=null;this.src='https://placehold.co/80x50/333/eee?text=No+Image';"></td>
                <td>${article.title}</td>
                <td>${article.author || 'N/A'}</td>
                <td data-status="${isPublished ? 'published' : 'draft'}">${publishedStatusHtml}</td>
                <td class="actions-buttons">
                    <button class="edit-news-btn btn primary btn-small" data-news-id="${articleId}">Edit</button>
                    <button class="delete-news-btn btn danger btn-small" data-news-id="${articleId}">Delete</button>
                </td>
            `;
        });

        newsTableBody.querySelectorAll('.edit-news-btn').forEach(button => {
            button.addEventListener('click', (event) => editNews(event.target.dataset.newsId));
        });
        newsTableBody.querySelectorAll('.delete-news-btn').forEach(button => {
            button.addEventListener('click', (event) => confirmDeleteNews(event.target.dataset.newsId));
        });

    } catch (error) {
        console.error("Error loading news for admin:", error);
        showToast('Failed to load news for admin. Please try again.', 'error');
        newsTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Error loading news.</td></tr>';
    }
};

/**
 * Loads and displays blog articles in the admin dashboard table.
 */
const loadBlogsForAdmin = async () => {
    if (!blogsTableBody) return;

    blogsTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading blog articles...</td></tr>';

    try {
        const blogsRef = collection(db, `artifacts/${appId}/blogs`);
        const q = query(blogsRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);

        blogsTableBody.innerHTML = '';

        if (querySnapshot.empty) {
            blogsTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No blog articles added yet.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const article = docSnap.data();
            const articleId = docSnap.id;
            const row = blogsTableBody.insertRow();
            row.dataset.articleId = articleId;

            const isPublished = article.scheduledAt && article.scheduledAt.toDate() <= new Date();
            const publishedStatusHtml = isPublished
                ? '<span class="status-active">Yes</span>'
                : '<span class="status-inactive">No</span>';

            row.innerHTML = `
                <td><img src="${article.imageUrl || 'https://placehold.co/80x50/333/eee?text=No+Image'}" alt="${article.title}" class="table-img" onerror="this.onerror=null;this.src='https://placehold.co/80x50/333/eee?text=No+Image';"></td>
                <td>${article.title}</td>
                <td>${article.author || 'N/A'}</td>
                <td data-status="${isPublished ? 'published' : 'draft'}">${publishedStatusHtml}</td>
                <td class="actions-buttons">
                    <button class="edit-blog-btn btn primary btn-small" data-blog-id="${articleId}">Edit</button>
                    <button class="delete-blog-btn btn danger btn-small" data-blog-id="${articleId}">Delete</button>
                </td>
            `;
        });

        blogsTableBody.querySelectorAll('.edit-blog-btn').forEach(button => {
            button.addEventListener('click', (event) => editBlog(event.target.dataset.blogId));
        });
        blogsTableBody.querySelectorAll('.delete-blog-btn').forEach(button => {
            button.addEventListener('click', (event) => confirmDeleteBlog(event.target.dataset.blogId));
        });

    } catch (error) {
        console.error("Error loading blogs for admin:", error);
        showToast('Failed to load blogs for admin. Please try again.', 'error');
        blogsTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Error loading blogs.</td></tr>';
    }
};

/**
 * Opens the NEWS form modal for adding a new news article.
 * Resets the form and sets the modal title.
 */
const addNews = () => {
    newsForm.reset();
    currentEditItemId = null;
    newsModalTitle.textContent = 'Add New News Article';
    document.getElementById('news-image').value = '';
    currentNewsImagePreview.style.display = 'none';
    currentNewsImagePreview.src = '';
    document.getElementById('news-scheduled-time').value = '';
    newsFormModal.style.display = 'flex';
};

/**
 * Opens the BLOG form modal for adding a new blog article.
 * Resets the form and sets the modal title.
 */
const addBlog = () => {
    blogForm.reset();
    currentEditItemId = null;
    blogModalTitle.textContent = 'Add New Blog Article';
    document.getElementById('blog-image').value = '';
    currentBlogImagePreview.style.display = 'none';
    currentBlogImagePreview.src = '';
    document.getElementById('blog-scheduled-time').value = '';
    blogFormModal.style.display = 'flex';
};

/**
 * Opens the NEWS form modal for editing an existing news article.
 * Fetches article data and populates the form fields.
 * @param {string} newsId The ID of the news article to edit.
 */
const editNews = async (newsId) => {
  try {
    const newsDocRef = doc(db, `artifacts/${appId}/news`, newsId);
    const newsDocSnap = await getDoc(newsDocRef);

    if (!newsDocSnap.exists()) {
      showToast('News article not found for editing.', 'error');
      return;
    }

    const newsArticle = newsDocSnap.data();
    currentEditItemId = newsId;
    newsModalTitle.textContent = 'Edit News Article';

    // Populate fields
    document.getElementById('news-title').value = newsArticle.title || '';
    document.getElementById('news-author').value = newsArticle.author || '';
    document.getElementById('news-content').value = newsArticle.content || '';
    document.getElementById('news-scheduled-time').value = newsArticle.scheduledAt
      ? newsArticle.scheduledAt.toDate().toISOString().slice(0, 16)
      : '';

    document.getElementById('news-category').value = newsArticle.category || '';
    document.getElementById('news-is-promotion').checked = newsArticle.isPromotion || false;

    // Consistent weeklyMagazine field
    const weeklyCheckbox = document.getElementById('weeklyMagazineCheckbox');
    if (weeklyCheckbox) weeklyCheckbox.checked = !!newsArticle.weeklyMagazine;

    // Show normal image preview if exists
    if (newsArticle.imageUrl) {
      if (currentNewsImagePreview) {
        currentNewsImagePreview.src = newsArticle.imageUrl;
        currentNewsImagePreview.style.display = 'block';
      } else {
        const el = document.getElementById('current-news-image-preview');
        if (el) { el.src = newsArticle.imageUrl; el.style.display = 'block'; }
      }
    } else {
      if (currentNewsImagePreview) {
        currentNewsImagePreview.src = '';
        currentNewsImagePreview.style.display = 'none';
      } else {
        const el = document.getElementById('current-news-image-preview');
        if (el) { el.src = ''; el.style.display = 'none'; }
      }
    }

    // Show banner preview if exists
    const currentNewsBannerPreview = document.getElementById('current-news-banner-preview');
    if (currentNewsBannerPreview) {
      if (newsArticle.bannerImageUrl) {
        currentNewsBannerPreview.src = newsArticle.bannerImageUrl;
        currentNewsBannerPreview.style.display = 'block';
      } else {
        currentNewsBannerPreview.src = '';
        currentNewsBannerPreview.style.display = 'none';
      }
    }

    // Clear file inputs
    const newsImageInput = document.getElementById('news-image');
    if (newsImageInput) newsImageInput.value = '';
    const newsBannerInput = document.getElementById('news-banner-image');
    if (newsBannerInput) newsBannerInput.value = '';

    // Show modal
    newsFormModal.style.display = 'flex';
  } catch (error) {
    console.error("Error editing news content:", error);
    showToast(`Failed to load news content for editing: ${error.message}`, 'error');
  }
};


/**
 * Opens the BLOG form modal for editing an existing blog article.
 * Fetches article data and populates the form fields.
 * @param {string} blogId The ID of the blog article to edit.
 */
const editBlog = async (blogId) => {
  try {
    const blogDocRef = doc(db, `artifacts/${appId}/blogs`, blogId);
    const blogDocSnap = await getDoc(blogDocRef);

    if (!blogDocSnap.exists()) {
      showToast('Blog article not found for editing.', 'error');
      return;
    }

    const blogArticle = blogDocSnap.data();
    currentEditItemId = blogId;
    blogModalTitle.textContent = 'Edit Blog Article';

    document.getElementById('blog-title').value = blogArticle.title || '';
    document.getElementById('blog-author').value = blogArticle.author || '';
    document.getElementById('blog-content').value = blogArticle.content || '';
    document.getElementById('blog-scheduled-time').value = blogArticle.scheduledAt
      ? blogArticle.scheduledAt.toDate().toISOString().slice(0, 16)
      : '';

    // Promotion checkbox
    const promoCheckbox = document.getElementById('blog-is-promotion');
    if (promoCheckbox) {
      promoCheckbox.checked = blogArticle.isPromotion === true;
    }

    // Weekly Magazine checkbox (use consistent field name `weeklyMagazine`)
    const magazineCheckbox = document.getElementById('weeklyMagazineCheckbox');
    if (magazineCheckbox) {
      magazineCheckbox.checked = !!blogArticle.weeklyMagazine;
    }

    // Handle normal image preview
    const currentBlogImagePreviewEl = document.getElementById('current-blog-image-preview');
    if (currentBlogImagePreviewEl) {
      if (blogArticle.imageUrl) {
        currentBlogImagePreviewEl.src = blogArticle.imageUrl;
        currentBlogImagePreviewEl.style.display = 'block';
      } else {
        currentBlogImagePreviewEl.src = '';
        currentBlogImagePreviewEl.style.display = 'none';
      }
    }

    // Handle banner preview
    const currentBlogBannerPreview = document.getElementById('current-blog-banner-preview');
    if (currentBlogBannerPreview) {
      if (blogArticle.bannerImageUrl) {
        currentBlogBannerPreview.src = blogArticle.bannerImageUrl;
        currentBlogBannerPreview.style.display = 'block';
      } else {
        currentBlogBannerPreview.src = '';
        currentBlogBannerPreview.style.display = 'none';
      }
    }

    // Clear file inputs for new upload
    const blogImageInput = document.getElementById('blog-image');
    if (blogImageInput) blogImageInput.value = '';
    const blogBannerInput = document.getElementById('blog-banner-image');
    if (blogBannerInput) blogBannerInput.value = '';

    // Show modal
    blogFormModal.style.display = 'flex';
  } catch (error) {
    console.error("Error editing blog content:", error);
    showToast(`Failed to load blog content for editing: ${error.message}`, 'error');
  }
};


/**
 * Handles the submission of the NEWS form.
 * Uploads image to Storage if a new file is selected.
 * @param {Event} event The form submission event.
 */
const handleNewsFormSubmit = async (event) => {
  event.preventDefault();

  const title = document.getElementById('news-title').value.trim();
  const author = document.getElementById('news-author').value.trim();
  const summaryText = document.getElementById('news-summary').value.trim();
  const contentText = document.getElementById('news-content').value.trim();
  const imageFile = document.getElementById('news-image').files[0];
  const newsBannerInputEl = document.getElementById('news-banner-image');
  const isPromotion = document.getElementById('news-is-promotion').checked;
  const weeklyMagazine = document.getElementById('weeklyMagazineCheckbox')?.checked || false;
  const category = document.getElementById('news-category').value.trim();
  const newsScheduledInput = document.getElementById('news-scheduled-time');

  // Validate required fields
  if (!title || !author || !summaryText || !contentText || !(newsScheduledInput && newsScheduledInput.value) || !category) {
    showToast('Please fill in all required fields including summary, category, and scheduled publish time.', 'warning');
    return;
  }

  // Determine scheduledAt
  let scheduledAt = Timestamp.now();
  if (newsScheduledInput && newsScheduledInput.value) {
    scheduledAt = Timestamp.fromDate(new Date(newsScheduledInput.value));
  }

  try {
    // --- NORMAL IMAGE (existing logic) ---
    let imageUrl = (currentNewsImagePreview && currentNewsImagePreview.src && currentNewsImagePreview.style.display !== 'none')
      ? currentNewsImagePreview.src
      : null;

    if (croppedNewsImageBlob) {
      const fileName = `${Date.now()}_news.jpg`;
      const fileFromBlob = new File([croppedNewsImageBlob], fileName, { type: croppedNewsImageBlob.type || 'image/jpeg' });

      // If editing and previous image is hosted on your host, delete it
      if (currentEditItemId && imageUrl && imageUrl.includes('moviereporter.in/uploads/')) {
        try { await deleteImageFromHostinger(imageUrl); } catch (e) { console.warn('Failed to delete old Hostinger image:', e); }
      }

      imageUrl = await uploadImageToHostinger(fileFromBlob, fileName);
      if (!imageUrl) {
        showToast('Failed to upload cropped news image.', 'error');
        return;
      }
    } else if (imageFile) {
      if (currentEditItemId && imageUrl && imageUrl.includes('moviereporter.in/uploads/')) {
        try { await deleteImageFromHostinger(imageUrl); } catch (e) { console.warn('Failed to delete old Hostinger image:', e); }
      }
      const fileName = `${Date.now()}_${imageFile.name}`;
      imageUrl = await uploadImageToHostinger(imageFile, fileName);
      if (!imageUrl) {
        showToast('Failed to upload news image.', 'error');
        return;
      }
    }

    // --- BANNER IMAGE (new logic) ---
    let bannerImageUrl = (currentNewsBannerPreview && currentNewsBannerPreview.src && currentNewsBannerPreview.style.display !== 'none')
      ? currentNewsBannerPreview.src
      : null;

    if (typeof croppedNewsBannerBlob !== 'undefined' && croppedNewsBannerBlob) {
      const bannerFileName = `${Date.now()}_news_banner.jpg`;
      const bannerFileFromBlob = new File([croppedNewsBannerBlob], bannerFileName, { type: croppedNewsBannerBlob.type || 'image/jpeg' });

      if (currentEditItemId && bannerImageUrl && bannerImageUrl.includes('moviereporter.in/uploads/')) {
        try { await deleteImageFromHostinger(bannerImageUrl); } catch (e) { console.warn('Failed to delete old Hostinger banner image:', e); }
      }

      bannerImageUrl = await uploadImageToHostinger(bannerFileFromBlob, bannerFileName);
      if (!bannerImageUrl) {
        showToast('Failed to upload cropped banner image.', 'error');
        return;
      }
    } else if (newsBannerInputEl && newsBannerInputEl.files && newsBannerInputEl.files[0]) {
      if (currentEditItemId && bannerImageUrl && bannerImageUrl.includes('moviereporter.in/uploads/')) {
        try { await deleteImageFromHostinger(bannerImageUrl); } catch (e) { console.warn('Failed to delete old Hostinger banner image:', e); }
      }
      const rawBannerFile = newsBannerInputEl.files[0];
      const bannerFileName = `${Date.now()}_${rawBannerFile.name}`;
      bannerImageUrl = await uploadImageToHostinger(rawBannerFile, bannerFileName);
      if (!bannerImageUrl) {
        showToast('Failed to upload banner image.', 'error');
        return;
      }
    }
    // If neither cropped blob nor file provided, bannerImageUrl remains as the preview src (could be existing hosted url or null)

    // Resolve createdAt properly when editing
    let createdAt = Timestamp.now();
    if (currentEditItemId) {
      try {
        const docRef = doc(db, `artifacts/${appId}/news`, currentEditItemId);
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().createdAt) {
          createdAt = snap.data().createdAt;
        }
      } catch (e) {
        console.warn('Could not fetch existing createdAt, using now:', e);
      }
    }

    const newsData = {
      title,
      author,
      summary: summaryText,
      content: contentText,
      imageUrl: imageUrl || null,
      bannerImageUrl: bannerImageUrl || null,
      scheduledAt,
      isPromotion,
      weeklyMagazine,
      category,
      createdAt
    };

    if (!currentEditItemId) {
      newsData.likesCount = 0;
      newsData.dislikesCount = 0;
      await addDoc(collection(db, `artifacts/${appId}/news`), newsData);
      showToast('News article added successfully!', 'success');
    } else {
      await updateDoc(doc(db, `artifacts/${appId}/news`, currentEditItemId), newsData);
      showToast('News article updated successfully!', 'success');
    }

    // Close modal and refresh list
    if (newsFormModal) newsFormModal.style.display = 'none';
    loadNewsForAdmin();
  } catch (error) {
    console.error('Error saving news content:', error);
    showToast(`Failed to save news content: ${error?.message || error}`, 'error');
  }
};

/**
 * Handles the submission of the BLOG form.
 * Uploads image to Storage if a new file is selected.
 * @param {Event} event The form submission event.
 */
const handleBlogFormSubmit = async (event) => {
  event.preventDefault();

  const title = document.getElementById('blog-title').value.trim();
  const author = document.getElementById('blog-author').value.trim();
  const contentText = document.getElementById('blog-content').value.trim();
  const imageFile = document.getElementById('blog-image').files[0];
  const blogBannerInputEl = document.getElementById('blog-banner-image');
  const isPromotion = document.getElementById('blog-is-promotion').checked;
  const weeklyMagazine = document.getElementById('weeklyMagazineCheckbox')?.checked || false;
  const blogScheduledInput = document.getElementById('blog-scheduled-time');

  // Validate required fields
  if (!title || !author || !contentText || !(blogScheduledInput && blogScheduledInput.value)) {
    showToast('Please fill in all required blog fields, including a scheduled publish time.', 'warning');
    return;
  }

  // Compute scheduledAt
  let scheduledAt = Timestamp.now();
  if (blogScheduledInput && blogScheduledInput.value) {
    scheduledAt = Timestamp.fromDate(new Date(blogScheduledInput.value));
  }

  try {
    // --- NORMAL IMAGE (existing logic) ---
    let imageUrl = (currentBlogImagePreview && currentBlogImagePreview.src && currentBlogImagePreview.style.display !== 'none')
      ? currentBlogImagePreview.src
      : null;

    if (croppedBlogImageBlob) {
      const fileName = `${Date.now()}_blog.jpg`;
      const fileFromBlob = new File([croppedBlogImageBlob], fileName, { type: croppedBlogImageBlob.type || 'image/jpeg' });

      if (currentEditItemId && imageUrl && imageUrl.includes('moviereporter.in/uploads/')) {
        try { await deleteImageFromHostinger(imageUrl); } catch (e) { console.warn('Failed to delete old Hostinger blog image:', e); }
      }

      imageUrl = await uploadImageToHostinger(fileFromBlob, fileName);
      if (!imageUrl) {
        showToast('Failed to upload cropped blog image.', 'error');
        return;
      }
    } else if (imageFile) {
      if (currentEditItemId && imageUrl && imageUrl.includes('moviereporter.in/uploads/')) {
        try { await deleteImageFromHostinger(imageUrl); } catch (e) { console.warn('Failed to delete old Hostinger blog image:', e); }
      }
      const fileName = `${Date.now()}_${imageFile.name}`;
      imageUrl = await uploadImageToHostinger(imageFile, fileName);
      if (!imageUrl) {
        showToast('Failed to upload blog image.', 'error');
        return;
      }
    }

    // --- BANNER IMAGE (new logic) ---
    let bannerImageUrl = (currentBlogBannerPreview && currentBlogBannerPreview.src && currentBlogBannerPreview.style.display !== 'none')
      ? currentBlogBannerPreview.src
      : null;

    if (typeof croppedBlogBannerBlob !== 'undefined' && croppedBlogBannerBlob) {
      const bannerFileName = `${Date.now()}_blog_banner.jpg`;
      const bannerFileFromBlob = new File([croppedBlogBannerBlob], bannerFileName, { type: croppedBlogBannerBlob.type || 'image/jpeg' });

      if (currentEditItemId && bannerImageUrl && bannerImageUrl.includes('moviereporter.in/uploads/')) {
        try { await deleteImageFromHostinger(bannerImageUrl); } catch (e) { console.warn('Failed to delete old Hostinger blog banner image:', e); }
      }

      bannerImageUrl = await uploadImageToHostinger(bannerFileFromBlob, bannerFileName);
      if (!bannerImageUrl) {
        showToast('Failed to upload cropped blog banner image.', 'error');
        return;
      }
    } else if (blogBannerInputEl && blogBannerInputEl.files && blogBannerInputEl.files[0]) {
      if (currentEditItemId && bannerImageUrl && bannerImageUrl.includes('moviereporter.in/uploads/')) {
        try { await deleteImageFromHostinger(bannerImageUrl); } catch (e) { console.warn('Failed to delete old Hostinger blog banner image:', e); }
      }
      const rawBannerFile = blogBannerInputEl.files[0];
      const bannerFileName = `${Date.now()}_${rawBannerFile.name}`;
      bannerImageUrl = await uploadImageToHostinger(rawBannerFile, bannerFileName);
      if (!bannerImageUrl) {
        showToast('Failed to upload blog banner image.', 'error');
        return;
      }
    }
    // If neither cropped blob nor file provided, bannerImageUrl remains as the preview src (could be existing hosted url or null)

    // Resolve createdAt properly when editing
    let createdAt = Timestamp.now();
    if (currentEditItemId) {
      try {
        const docRef = doc(db, `artifacts/${appId}/blogs`, currentEditItemId);
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().createdAt) {
          createdAt = snap.data().createdAt;
        }
      } catch (e) {
        console.warn('Could not fetch existing createdAt for blog, using now:', e);
      }
    }

    const blogData = {
      title,
      author,
      content: contentText,
      imageUrl: imageUrl || null,
      bannerImageUrl: bannerImageUrl || null,
      scheduledAt,
      isPromotion,
      weeklyMagazine,
      createdAt
    };

    if (!currentEditItemId) {
      // New post: initialize counts
      blogData.likesCount = 0;
      blogData.dislikesCount = 0;
      await addDoc(collection(db, `artifacts/${appId}/blogs`), blogData);
      showToast('Blog article added successfully!', 'success');
    } else {
      // Update existing (do not overwrite existing counts unless you intend to)
      await updateDoc(doc(db, `artifacts/${appId}/blogs`, currentEditItemId), blogData);
      showToast('Blog article updated successfully!', 'success');
    }

    // Close modal and refresh list
    if (blogFormModal) blogFormModal.style.display = 'none';
    loadBlogsForAdmin();
  } catch (error) {
    console.error('Error saving blog content:', error);
    showToast(`Failed to save blog content: ${error?.message || error}`, 'error');
  }
};

/**
 * Confirms and deletes a NEWS article and its associated data (comments, image).
 * Uses a transaction for atomicity.
 * @param {string} newsId The ID of the news article to delete.
 */
const confirmDeleteNews = (newsId) => {
    showCustomModal('Are you sure you want to delete this news article? This will also delete its image and associated comments.', async () => {
        try {
            await runTransaction(db, async (transaction) => {
                const newsDocRef = doc(db, `artifacts/${appId}/news`, newsId);
                const newsDocSnap = await transaction.get(newsDocRef);

                if (!newsDocSnap.exists()) {
                    throw new Error("News article not found for deletion.");
                }

                const newsData = newsDocSnap.data();

                if (newsData.imageUrl) {
                    await deleteImage(newsData.imageUrl);
                }

                const commentsQuery = query(
                    collection(db, `artifacts/${appId}/comments`),
                    where('articleId', '==', newsId),
                    where('articleType', '==', 'news')
                );
                const commentSnapshots = await getDocs(commentsQuery);
                for (const commentDocSnap of commentSnapshots.docs) {
                    transaction.delete(doc(db, `artifacts/${appId}/comments`, commentDocSnap.id));
                    const userIdFromComment = commentDocSnap.data().userId;
                    if (userIdFromComment) {
                        transaction.delete(doc(db, `artifacts/${appId}/users/${userIdFromComment}/userComments`, commentDocSnap.id));
                    }
                }

                transaction.delete(newsDocRef);
            });

            showToast('News article deleted successfully!', 'success');
            loadNewsForAdmin();
        } catch (error) {
            console.error("Error deleting news content:", error);
            showToast(`Failed to delete news content: ${error.message}`, 'error');
        }
    });
};

/**
 * Confirms and deletes a BLOG article and its associated data (comments, image).
 * Uses a transaction for atomicity.
 * @param {string} blogId The ID of the blog article to delete.
 */
const confirmDeleteBlog = (blogId) => {
    showCustomModal('Are you sure you want to delete this blog article? This will also delete its image and associated comments.', async () => {
        try {
            await runTransaction(db, async (transaction) => {
                const blogDocRef = doc(db, `artifacts/${appId}/blogs`, blogId);
                const blogDocSnap = await transaction.get(blogDocRef);

                if (!blogDocSnap.exists()) {
                    throw new Error("Blog article not found for deletion.");
                }

                const blogData = blogDocSnap.data();

                if (blogData.imageUrl) {
                    await deleteImage(blogData.imageUrl);
                }

                const commentsQuery = query(
                    collection(db, `artifacts/${appId}/comments`),
                    where('articleId', '==', blogId),
                    where('articleType', '==', 'blog')
                );
                const commentSnapshots = await getDocs(commentsQuery);
                for (const commentDocSnap of commentSnapshots.docs) {
                    transaction.delete(doc(db, `artifacts/${appId}/comments`, commentDocSnap.id));
                    const userIdFromComment = commentDocSnap.data().userId;
                    if (userIdFromComment) {
                        transaction.delete(doc(db, `artifacts/${appId}/users/${userIdFromComment}/userComments`, commentDocSnap.id));
                    }
                }

                transaction.delete(blogDocRef);
            });

            showToast('Blog article deleted successfully!', 'success');
            loadBlogsForAdmin();
        } catch (error) {
            console.error("Error deleting blog content:", error);
            showToast(`Failed to delete blog content: ${error.message}`, 'error');
        }
    });
};


// --- Awards Management Functions ---

/**
 * Clears all award-related form fields and previews.
 * Useful when switching between category and nominee management or adding new items.
 */
const clearAllAwardForms = () => {
    categoryForm.reset();
    nomineeForm.reset();
    currentNomineePhotoPreview.style.display = 'none';
    currentNomineePhotoPreview.src = '';
    currentEditItemId = null;
    currentNomineeCategoryId = null;
    // Clear nominee-specific search
    if (nomineeCelebritySearchInput) nomineeCelebritySearchInput.value = '';
    if (nomineeCelebritySuggestionsDiv) nomineeCelebritySuggestionsDiv.style.display = 'none';
    selectedNomineeCelebrity = null;
    document.getElementById('nominee-name').value = ''; // Ensure name field is clear
    document.getElementById('nominee-description').value = ''; // Ensure description field is clear
};

/**
 * Loads and displays award categories for the selected industry in the admin dashboard.
 * @param {string} industry The selected industry (e.g., 'Bollywood').
 */
const loadAdminAwardsCategories = async (industry) => {
    if (!categoriesTableBody) return;

    clearAllAwardForms();
    categoriesTableBody.innerHTML = '<tr><td colspan="3" class="text-center">Loading categories...</td></tr>';
    nomineesTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Select a category to view nominees.</td></tr>';

    adminNoIndustrySelected.style.display = 'none';
    categoriesSection.style.display = 'block';
    nomineesSection.style.display = 'none';
    currentCategoryNameSpan.textContent = '';

    if (!industry) {
        adminNoIndustrySelected.style.display = 'block';
        categoriesSection.style.display = 'none';
        return;
    }

    try {
        const categoriesRef = collection(db, `artifacts/${appId}/categories`);
        const q = query(categoriesRef, where('industry', '==', industry), orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);

        categoriesTableBody.innerHTML = '';

        if (querySnapshot.empty) {
            categoriesTableBody.innerHTML = '<tr><td colspan="3" class="text-center">No categories added for this industry yet.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const category = docSnap.data();
            const categoryId = docSnap.id;
            const row = categoriesTableBody.insertRow();
            row.dataset.categoryId = categoryId;

            const startTime = category.startTime ? formatDateTime(category.startTime) : 'Not Set';
            const endTime = category.endTime ? formatDateTime(category.endTime) : 'Not Set';

            row.innerHTML = `
                <td>${category.name}</td>
                <td>${startTime} - ${endTime}</td>
                <td class="actions-buttons">
                    <button class="view-nominees-btn btn secondary btn-small" data-category-id="${categoryId}" data-category-name="${category.name}">View Nominees</button>
                    <button class="edit-category-btn btn primary btn-small" data-category-id="${categoryId}">Edit</button>
                    <button class="delete-category-btn btn danger btn-small" data-category-id="${categoryId}">Delete</button>
                </td>
            `;
        });

        categoriesTableBody.querySelectorAll('.view-nominees-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                currentNomineeCategoryId = event.target.dataset.categoryId;
                const categoryName = event.target.dataset.categoryName;
                currentCategoryNameSpan.textContent = categoryName;
                categoriesSection.style.display = 'none';
                nomineesSection.style.display = 'block';
                loadNomineesForAdmin(currentNomineeCategoryId);
            });
        });
        categoriesTableBody.querySelectorAll('.edit-category-btn').forEach(button => {
            button.addEventListener('click', (event) => editCategory(event.target.dataset.categoryId));
        });
        categoriesTableBody.querySelectorAll('.delete-category-btn').forEach(button => {
            button.addEventListener('click', (event) => confirmDeleteCategory(event.target.dataset.categoryId));
        });

    } catch (error) {
        console.error("Error loading awards categories for admin:", error);
        showToast('Failed to load awards categories for admin. Please try again.', 'error');
        categoriesTableBody.innerHTML = '<tr><td colspan="3" class="text-center">Error loading categories.</td></tr>';
    }
};

/**
 * Opens the category form modal for adding a new award category.
 * Resets the form and modal title.
 */
const addCategory = () => {
    categoryForm.reset();
    currentEditItemId = null;
    categoryModalTitle.textContent = 'Add New Category';
    document.getElementById('voting-start-time').value = '';
    document.getElementById('voting-end-time').value = '';
    categoryFormModal.style.display = 'flex';
};

/**
 * Opens the category form modal for editing an existing award category.
 * Fetches category data and populates the form fields.
 * @param {string} categoryId The ID of the category to edit.
 */
const editCategory = async (categoryId) => {
    try {
        const categoryDocRef = doc(db, `artifacts/${appId}/categories`, categoryId);
        const categoryDocSnap = await getDoc(categoryDocRef);

        if (!categoryDocSnap.exists()) {
            showToast('Category not found for editing.', 'error');
            return;
        }

        const category = categoryDocSnap.data();
        currentEditItemId = categoryId;
        categoryModalTitle.textContent = 'Edit Category';

        document.getElementById('category-name').value = category.name || '';
        document.getElementById('voting-start-time').value = category.startTime ? category.startTime.toDate().toISOString().slice(0, 16) : '';
        document.getElementById('voting-end-time').value = category.endTime ? category.endTime.toDate().toISOString().slice(0, 16) : '';

        categoryFormModal.style.display = 'flex';
    } catch (error) {
        console.error("Error editing category:", error);
        showToast(`Failed to load category for editing: ${error.message}`, 'error');
    }
};

/**
 * Handles the submission of the category form (for both adding new categories and editing existing ones).
 * Validates dates and saves to Firestore.
 * @param {Event} event The form submission event.
 */
const handleCategoryFormSubmit = async (event) => {
    event.preventDefault();

    const categoryName = document.getElementById('category-name').value.trim();
    const industry = adminAwardsIndustrySelector.value;
    const startTimeStr = document.getElementById('voting-start-time').value;
    const endTimeStr = document.getElementById('voting-end-time').value;

    if (!categoryName || !industry) {
        showToast('Please fill in all required category fields and select an industry.', 'warning');
        return;
    }

    let startTime = null;
    let endTime = null;

    if (startTimeStr) {
        startTime = Timestamp.fromDate(new Date(startTimeStr));
    }
    if (endTimeStr) {
        endTime = Timestamp.fromDate(new Date(endTimeStr));
    }

    if (startTime && endTime && startTime.toDate() >= endTime.toDate()) {
        showToast('End time must be after start time.', 'warning');
        return;
    }

    try {
        const categoryData = {
            name: categoryName,
            industry: industry,
            startTime: startTime,
            endTime: endTime,
            createdAt: currentEditItemId ? (await getDoc(doc(db, `artifacts/${appId}/categories`, currentEditItemId))).data().createdAt : Timestamp.now()
        };

        if (currentEditItemId) {
            await updateDoc(doc(db, `artifacts/${appId}/categories`, currentEditItemId), categoryData);
            showToast('Category updated successfully!', 'success');
        } else {
            await addDoc(collection(db, `artifacts/${appId}/categories`), categoryData);
            showToast('Category added successfully!', 'success');
        }

        categoryFormModal.style.display = 'none';
        loadAdminAwardsCategories(industry);
    } catch (error) {
        console.error("Error saving category:", error);
        showToast(`Failed to save category: ${error.message}`, 'error');
    }
};

/**
 * Confirms with the user and then deletes an award category and its associated nominees and votes.
 * @param {string} categoryId The ID of the category to delete.
 */
const confirmDeleteCategory = (categoryId) => {
    showCustomModal('Are you sure you want to delete this category? This will also delete all associated nominees and their votes.', async () => {
        try {
            await runTransaction(db, async (transaction) => {
                const categoryDocRef = doc(db, `artifacts/${appId}/categories`, categoryId);
                const categoryDocSnap = await transaction.get(categoryDocRef);

                if (!categoryDocSnap.exists()) {
                    throw new Error("Category not found for deletion.");
                }

                const docsToDelete = [];
                const photoDeletePromises = [];

                const nomineesQuery = query(
                    collection(db, `artifacts/${appId}/nominees`),
                    where('categoryId', '==', categoryId)
                );
                const nomineeSnapshots = await getDocs(nomineesQuery);

                for (const nomineeDocSnap of nomineeSnapshots.docs) {
                    const nomineeData = nomineeDocSnap.data();
                    const nomineeId = nomineeDocSnap.id;
                    const nomineeRef = doc(db, `artifacts/${appId}/nominees`, nomineeId);

                    let shouldDeletePhoto = true;

                    if (nomineeData.celebrityId) {
                        const celebRef = doc(db, `artifacts/${appId}/celebrities`, nomineeData.celebrityId);
                        const celebSnap = await getDoc(celebRef);

                        if (celebSnap.exists()) {
                            const celebData = celebSnap.data();
                            if (celebData.imageUrl === nomineeData.photoUrl) {
                                shouldDeletePhoto = false;
                            }
                        }
                    }

                    if (nomineeData.photoUrl && shouldDeletePhoto) {
                        photoDeletePromises.push(deleteImage(nomineeData.photoUrl));
                    }

                    docsToDelete.push(nomineeRef);
                }

                const usersColRef = collection(db, `artifacts/${appId}/users`);
                const usersSnapshot = await getDocs(usersColRef);

                for (const userDocSnap of usersSnapshot.docs) {
                    const userId = userDocSnap.id;
                    const userVoteRef = doc(db, `artifacts/${appId}/users/${userId}/userVotes`, categoryId);
                    const userVoteSnap = await transaction.get(userVoteRef);
                    if (userVoteSnap.exists()) {
                        docsToDelete.push(userVoteRef);
                    }
                }

                // Delete photos outside of the transaction
                await Promise.all(photoDeletePromises);

                // Queue all doc deletions in transaction
                for (const ref of docsToDelete) {
                    transaction.delete(ref);
                }

                transaction.delete(categoryDocRef);
            });

            showToast('Category deleted successfully!', 'success');
            loadAdminAwardsCategories(adminAwardsIndustrySelector.value);
        } catch (error) {
            console.error("Error deleting category:", error);
            showToast(`Failed to delete category: ${error.message}`, 'error');
        }
    });
};


/**
 * Loads and displays nominees for a specific category in the admin dashboard table.
 * @param {string} categoryId The ID of the category to load nominees for.
 */
const loadNomineesForAdmin = async (categoryId) => {
    if (!nomineesTableBody) return;

    nomineesTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading nominees...</td></tr>';

    try {
        const nomineesRef = collection(db, `artifacts/${appId}/nominees`);
        const q = query(nomineesRef, where('categoryId', '==', categoryId), orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);

        nomineesTableBody.innerHTML = '';

        if (querySnapshot.empty) {
            nomineesTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No nominees added for this category yet.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const nominee = docSnap.data();
            const nomineeId = docSnap.id;
            const row = nomineesTableBody.insertRow();
            row.dataset.nomineeId = nomineeId;

            row.innerHTML = `
  <td>
    <img src="${nominee.photoUrl || 'https://placehold.co/60x60/333/eee?text=No+Photo'}" 
         alt="${nominee.name}" 
         class="table-img rounded-full" 
         onerror="this.onerror=null;this.src='https://placehold.co/60x60/333/eee?text=No+Photo';">
  </td>
  <td>${nominee.name}</td>
  <td>
    ${nominee.movieTitle && nominee.movieId
      ? `<a href="movie-details.html?movieId=${nominee.movieId}" target="_blank">${nominee.movieTitle}</a>`
      : '<span class="text-muted" style="color:black;">No Movie</span>'}
  </td>
  <td>${nominee.votes || 0}</td>
  <td class="actions-buttons">
    <button class="edit-nominee-btn btn primary btn-small" data-nominee-id="${nomineeId}">
      Edit
    </button>
    <button class="delete-nominee-btn btn danger btn-small" data-nominee-id="${nomineeId}">
      Delete
    </button>
  </td>
`;

        });

        nomineesTableBody.querySelectorAll('.edit-nominee-btn').forEach(button => {
            button.addEventListener('click', (event) => editNominee(event.target.dataset.nomineeId));
        });
        nomineesTableBody.querySelectorAll('.delete-nominee-btn').forEach(button => {
            button.addEventListener('click', (event) => confirmDeleteNominee(event.target.dataset.nomineeId));
        });

    } catch (error) {
        console.error("Error loading nominees for admin:", error);
        showToast('Failed to load nominees for admin. Please try again.', 'error');
        nomineesTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Error loading nominees.</td></tr>';
    }
};

/**
 * Opens the nominee form modal for adding a new nominee.
 * Resets the form and modal title.
 */
const addNominee = () => {
    nomineeForm.reset();
    currentEditItemId = null;
    nomineeModalTitle.textContent = 'Add New Nominee';
    document.getElementById('nominee-photo').value = '';
    currentNomineePhotoPreview.style.display = 'none';
    currentNomineePhotoPreview.src = '';

    // Celebrity reset
    nomineeCelebritySearchInput.value = '';
    nomineeCelebritySuggestionsDiv.style.display = 'none';
    selectedNomineeCelebrity = null;
    document.getElementById('nominee-name').value = '';
    document.getElementById('nominee-description').value = '';

    // ✅ Movie reset
    document.getElementById('nominee-movie-search-input').value = '';
    nomineeMovieSuggestionsDiv.style.display = 'none';
    selectedNomineeMovie = null;
    document.getElementById('nominee-movie-title').value = '';

    nomineeFormModal.style.display = 'flex';
};

const nomineeMovieSearchInput = document.getElementById('nominee-movie-search-input');
const nomineeMovieTitleInput = document.getElementById('nominee-movie-title');


/**
 * Opens the nominee form modal for editing an existing nominee.
 * Fetches nominee data and populates the form fields.
 * @param {string} nomineeId The ID of the nominee to edit.
 */
const editNominee = async (nomineeId) => {
    try {
        const nomineeDocRef = doc(db, `artifacts/${appId}/nominees`, nomineeId);
        const nomineeDocSnap = await getDoc(nomineeDocRef);

        if (!nomineeDocSnap.exists()) {
            showToast('Nominee not found for editing.', 'error');
            return;
        }

        const nominee = nomineeDocSnap.data();
        currentEditItemId = nomineeId;
        nomineeModalTitle.textContent = 'Edit Nominee';

        document.getElementById('nominee-name').value = nominee.name || '';
        document.getElementById('nominee-description').value = nominee.description || '';

        // Celebrity pre-fill
        if (nominee.celebrityId && nominee.celebrityName) {
            nomineeCelebritySearchInput.value = nominee.celebrityName;
            selectedNomineeCelebrity = {
                id: nominee.celebrityId,
                name: nominee.celebrityName,
                imageUrl: nominee.photoUrl || ''
            };
        } else {
            nomineeCelebritySearchInput.value = '';
            selectedNomineeCelebrity = null;
        }
        nomineeCelebritySuggestionsDiv.style.display = 'none';

        // ✅ Movie pre-fill
        if (nominee.movieId && nominee.movieTitle) {
            nomineeMovieSearchInput.value = nominee.movieTitle;
            selectedNomineeMovie = {
                id: nominee.movieId,
                title: nominee.movieTitle
            };
            document.getElementById('nominee-movie-title').value = nominee.movieTitle;
        } else {
            nomineeMovieSearchInput.value = '';
            selectedNomineeMovie = null;
            document.getElementById('nominee-movie-title').value = '';
        }
        nomineeMovieSuggestionsDiv.style.display = 'none';

        // Photo
        if (nominee.photoUrl) {
            currentNomineePhotoPreview.src = nominee.photoUrl;
            currentNomineePhotoPreview.style.display = 'block';
        } else {
            currentNomineePhotoPreview.src = '';
            currentNomineePhotoPreview.style.display = 'none';
        }
        document.getElementById('nominee-photo').value = '';

        nomineeFormModal.style.display = 'flex';
    } catch (error) {
        console.error("Error editing nominee:", error);
        showToast(`Failed to load nominee for editing: ${error.message}`, 'error');
    }
};


const searchNomineeMovies = async (searchTerm) => {
  clearTimeout(searchNomineeMovieTimeout);
  nomineeMovieSuggestionsDiv.innerHTML = '';
  nomineeMovieSuggestionsDiv.style.display = 'none';

  if (searchTerm.trim().length < 2) return;

  searchNomineeMovieTimeout = setTimeout(async () => {
    try {
      const ref = collection(db, `artifacts/${appId}/movies`);
      const q = query(ref, orderBy('title'));
      const snapshot = await getDocs(q);

      const allMovies = snapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title || 'Untitled',
        posterUrl: doc.data().posterUrl || '',
        releaseDate: doc.data().releaseDate?.toDate() || null
      }));

      const filtered = allMovies.filter(movie =>
        movie.title.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 10);

      renderNomineeMovieSuggestions(filtered);
    } catch (err) {
      console.error("Error searching movies:", err);
      showToast('Failed to search movies for nominee.', 'error');
    }
  }, 300);
};

function renderNomineeMovieSuggestions(movies) {
  nomineeMovieSuggestionsDiv.innerHTML = '';
  nomineeMovieSuggestionsDiv.style.display = 'block';

  movies.forEach(movie => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.innerHTML = `
      <img src="${movie.posterUrl || 'https://placehold.co/50x70'}" alt="Poster" class="suggestion-thumb">
      <span>${movie.title}</span>
    `;
    item.onclick = () => {
      selectedNomineeMovie = movie;
      nomineeMovieTitleField.value = movie.title;
      nomineeMovieSuggestionsDiv.style.display = 'none';
    };
    nomineeMovieSuggestionsDiv.appendChild(item);
  });
}


/**
 * Handles the submission of the nominee form (for both adding new nominees and editing existing ones).
 * Uploads photo to Storage if a new file is selected.
 * @param {Event} event The form submission event.
 */
const handleNomineeFormSubmit = async (event) => {
    event.preventDefault();

    const name = document.getElementById('nominee-name').value.trim();
    const description = document.getElementById('nominee-description').value.trim();
    const photoFile = document.getElementById('nominee-photo').files[0];

    if (!name || !description) {
        showToast('Please fill in all required nominee fields.', 'warning');
        return;
    }
    if (!currentNomineeCategoryId) {
        showToast('No category selected for this nominee. Please go back and select a category first.', 'error');
        return;
    }

    try {
        let photoUrl = null;
        let celebrityId = null;
        let celebrityName = null;

        // Priority 1: Newly uploaded photo
        if (photoFile) {
            const fileName = `${Date.now()}_${photoFile.name}`;
            photoUrl = await uploadImage(photoFile, 'nominee_photos/', fileName);
            if (!photoUrl) {
                showToast('Failed to upload nominee photo.', 'error');
                return;
            }
        }
        // Priority 2: Selected celebrity's image (if a celebrity was selected and has an image)
        else if (selectedNomineeCelebrity && selectedNomineeCelebrity.imageUrl) {
            photoUrl = selectedNomineeCelebrity.imageUrl;
        }
        // Priority 3: Existing photo if editing and no new photo/celebrity selected
        else if (currentEditItemId) {
            const existingNomineeDoc = await getDoc(doc(db, `artifacts/${appId}/nominees`, currentEditItemId));
            if (existingNomineeDoc.exists()) {
                photoUrl = existingNomineeDoc.data().photoUrl || null;
            }
        }

        // Set celebrityId and celebrityName if a celebrity was selected
        if (selectedNomineeCelebrity) {
            celebrityId = selectedNomineeCelebrity.id;
            celebrityName = selectedNomineeCelebrity.name;
        }

        const nomineeData = {
    name,
    description,
    photoUrl,
    categoryId: currentNomineeCategoryId,
    votes: 0,
    celebrityId: celebrityId,
    celebrityName: celebrityName,
    createdAt: currentEditItemId
        ? (await getDoc(doc(db, `artifacts/${appId}/nominees`, currentEditItemId))).data().createdAt
        : Timestamp.now(),
    
    // ✅ New fields
    movieId: selectedNomineeMovie?.id || null,
    movieTitle: nomineeMovieTitleField.value || null
};


        if (currentEditItemId) {
            const existingNomineeDoc = await getDoc(doc(db, `artifacts/${appId}/nominees`, currentEditItemId));
            if (existingNomineeDoc.exists()) {
                nomineeData.votes = existingNomineeDoc.data().votes || 0;
            }
            await updateDoc(doc(db, `artifacts/${appId}/nominees`, currentEditItemId), nomineeData);
            showToast('Nominee updated successfully!', 'success');
        } else {
            await addDoc(collection(db, `artifacts/${appId}/nominees`), nomineeData);
            showToast('Nominee added successfully!', 'success');
        }

        nomineeFormModal.style.display = 'none';
        loadNomineesForAdmin(currentNomineeCategoryId);
    } catch (error) {
        console.error("Error saving nominee:", error);
        showToast(`Failed to save nominee: ${error.message}`, 'error');
    }
};

nomineeMovieInput?.addEventListener('input', () => {
  searchNomineeMovies(nomineeMovieInput.value);
});

document.getElementById('add-nominee-movie-btn')?.addEventListener('click', () => {
  selectedNomineeMovie = null;
  nomineeMovieTitleField.value = nomineeMovieInput.value.trim();
  nomineeMovieSuggestionsDiv.style.display = 'none';
});


let searchNomineeCelebrityTimeout;
/**
 * Searches for celebrities for the nominee form and displays suggestions.
 * @param {string} searchTerm The text to search for.
 */
const searchNomineeCelebrities = async (searchTerm) => {
    clearTimeout(searchNomineeCelebrityTimeout);
    nomineeCelebritySuggestionsDiv.innerHTML = '';
    nomineeCelebritySuggestionsDiv.style.display = 'none';

    if (searchTerm.trim().length < 2) {
        return;
    }

    searchNomineeCelebrityTimeout = setTimeout(async () => {
        try {
            const celebritiesRef = collection(db, `artifacts/${appId}/celebrities`);
            const q = query(celebritiesRef, orderBy('name'));
            const querySnapshot = await getDocs(q);

            const allCelebrities = querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name, imageUrl: doc.data().imageUrl || '', role: doc.data().role, description: doc.data().description || '' })); // Include description
            const filteredSuggestions = allCelebrities.filter(celeb =>
                celeb.name.toLowerCase().includes(searchTerm.toLowerCase())
            ).slice(0, 10);

            renderNomineeCelebritySuggestions(filteredSuggestions);

        } catch (error) {
            console.error("Error searching celebrities for nominee:", error);
            showToast('Failed to search celebrities for nominee.', 'error');
        }
    }, 300);
};

/**
 * Renders the search suggestions for nominee celebrity in the dropdown.
 * @param {Array<Object>} suggestions An array of celebrity objects ({id, name, imageUrl, role, description}).
 */
const renderNomineeCelebritySuggestions = (suggestions) => {
    nomineeCelebritySuggestionsDiv.innerHTML = '';
    if (suggestions.length === 0) {
        nomineeCelebritySuggestionsDiv.style.display = 'none';
        return;
    }

    suggestions.forEach(celeb => {
        const suggestionItem = document.createElement('div');
        suggestionItem.classList.add('celebrity-suggestion-item');
        suggestionItem.innerHTML = `
            <img src="${celeb.imageUrl || 'https://placehold.co/30x30/333/eee?text=No'}" alt="${celeb.name}" class="rounded-full" style="width:30px; height:30px; object-fit:cover; margin-right: 10px;" onerror="this.onerror=null;this.src='https://placehold.co/30x30/333/eee?text=No';">
            <span>${celeb.name} <small>(${celeb.role || 'N/A'})</small></span>
        `;
        suggestionItem.addEventListener('click', () => {
            document.getElementById('nominee-name').value = celeb.name;
            document.getElementById('nominee-description').value = celeb.description || ''; // Also populate description if available
            currentNomineePhotoPreview.src = celeb.imageUrl || '';
            currentNomineePhotoPreview.style.display = celeb.imageUrl ? 'block' : 'none';
            selectedNomineeCelebrity = { id: celeb.id, name: celeb.name, imageUrl: celeb.imageUrl, description: celeb.description }; // Store full celebrity object
            nomineeCelebritySearchInput.value = celeb.name; // Keep the selected name in the search box
            nomineeCelebritySuggestionsDiv.style.display = 'none'; // Hide suggestions
            document.getElementById('nominee-photo').value = ''; // Clear file input as image is now from celebrity profile
        });
        nomineeCelebritySuggestionsDiv.appendChild(suggestionItem);
    });
    nomineeCelebritySuggestionsDiv.style.display = 'block';
};

/**
 * Confirms with the user and then deletes a nominee and its associated data (photo).
 * @param {string} nomineeId The ID of the nominee to delete.
 */
const confirmDeleteNominee = (nomineeId) => {
    showCustomModal('Are you sure you want to delete this nominee? This will remove them from all voting records.', async () => {
        try {
            await runTransaction(db, async (transaction) => {
                const nomineeDocRef = doc(db, `artifacts/${appId}/nominees`, nomineeId);
                const nomineeDocSnap = await transaction.get(nomineeDocRef);

                if (!nomineeDocSnap.exists()) {
                    throw new Error("Nominee not found for deletion.");
                }

                const nomineeData = nomineeDocSnap.data();
                const nomineePhoto = nomineeData.photoUrl;

                let shouldDeletePhoto = true;

                if (nomineeData.celebrityId && nomineePhoto) {
                    const celebRef = doc(db, `artifacts/${appId}/celebrities`, nomineeData.celebrityId);
                    const celebSnap = await getDoc(celebRef);
                    if (celebSnap.exists()) {
                        const celebData = celebSnap.data();
                        if (celebData.imageUrl === nomineePhoto) {
                            shouldDeletePhoto = false; // Photo is shared with celebrity profile
                        }
                    }
                }

                if (nomineePhoto && shouldDeletePhoto) {
                    await deleteImage(nomineePhoto);
                }

                transaction.delete(nomineeDocRef);
            });

            showToast('Nominee deleted successfully!', 'success');
            loadNomineesForAdmin(currentNomineeCategoryId);
        } catch (error) {
            console.error("Error deleting nominee:", error);
            showToast(`Failed to delete nominee: ${error.message}`, 'error');
        }
    });
};


// --- User Management Functions ---

/**
 * Loads and displays users in the admin dashboard table, with optional search filtering.
 * User profile data is now directly on the user's UID document.
 * @param {string} searchTerm Optional term to search by username or email.
 */
const loadUsers = async (searchTerm = '') => {
    if (!usersTableBody) return;

    usersTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Loading users...</td></tr>';

    try {
        const usersColRef = collection(db, `artifacts/${appId}/users`);
        const querySnapshot = await getDocs(query(usersColRef));

        const users = [];
        const lowerCaseSearchTerm = searchTerm.toLowerCase();

        for (const docSnap of querySnapshot.docs) {
            const userData = docSnap.data();
            const userId = docSnap.id;

            const email = userData.email || 'N/A';
            const username = userData.username || 'N/A';
            const role = userData.role || 'user';
            const status = userData.status || 'active';

            const matchesSearch = !lowerCaseSearchTerm ||
                (username && username.toLowerCase().includes(lowerCaseSearchTerm)) ||
                (email && email.toLowerCase().includes(lowerCaseSearchTerm));
            if (matchesSearch) {
                users.push({ userId, email, username, role, status });
            }
        }

        usersTableBody.innerHTML = '';

        if (users.length === 0) {
            usersTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No users found.</td></tr>';
            return;
        }

        users.sort((a, b) => (a.username || '').localeCompare(b.username || '')); // Handle N/A usernames gracefully

        users.forEach(user => {
            const row = usersTableBody.insertRow();
            row.dataset.userId = user.userId;

            row.innerHTML = `
                <td>${user.userId}</td>
                <td>${user.email}</td>
                <td>${user.username}</td>
                <td>${user.role}</td>
                <td>${user.status === 'active' ? '<span class="status-active">Active</span>' : '<span class="status-inactive">Blocked</span>'}</td>
                <td class="actions-buttons">
                    <button class="promote-demote-btn btn primary btn-small" data-user-id="${user.userId}" data-current-role="${user.role}">
                        ${user.role === 'admin' ? 'Demote' : 'Promote'}
                    </button>
                    <button class="block-unblock-btn btn ${user.status === 'active' ? 'danger' : 'success'} btn-small" data-user-id="${user.userId}" data-current-status="${user.status}">
                        ${user.status === 'active' ? 'Block' : 'Unblock'}
                    </button>
                    <button class="delete-user-btn btn danger btn-small" data-user-id="${user.userId}">Delete</button>
                </td>
            `;
        });

        usersTableBody.querySelectorAll('.promote-demote-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const userId = event.target.dataset.userId;
                const currentRole = event.target.dataset.currentRole;
                toggleUserRole(userId, currentRole);
            });
        });
        usersTableBody.querySelectorAll('.block-unblock-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const userId = event.target.dataset.userId;
                const currentStatus = event.target.dataset.currentStatus;
                toggleUserStatus(userId, currentStatus);
            });
        });
        usersTableBody.querySelectorAll('.delete-user-btn').forEach(button => {
            button.addEventListener('click', (event) => confirmDeleteUser(event.target.dataset.userId));
        });

    } catch (error) {
        console.error("Error loading users:", error);
        showToast('Failed to load users. Please try again.', 'error');
        usersTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Error loading users.</td></tr>';
    }
};

/**
 * Toggles a user's role between 'admin' and 'user'.
 * Prevents an admin from changing their own role.
 * @param {string} userId The ID of the user to modify.
 * @param {string} currentRole The user's current role ('admin' or 'user').
 */
const toggleUserRole = (userId, currentRole) => {
    if (userId === currentUserId) {
        showToast('You cannot change your own role.', 'warning');
        return;
    }

    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    showCustomModal(`Are you sure you want to ${newRole === 'admin' ? 'promote' : 'demote'} this user to ${newRole}?`, async () => {
        try {
            const userProfileRef = doc(db, `artifacts/${appId}/users`, userId);
            await updateDoc(userProfileRef, { role: newRole });
            showToast(`User role updated to ${newRole}!`, 'success');
            loadUsers();
        } catch (error) {
            console.error("Error updating user role:", error);
            showToast(`Failed to update user role: ${error.message}`, 'error');
        }
    });
};

/**
 * Toggles a user's status between 'active' and 'blocked'.
 * Prevents an admin from blocking/unblocking themselves.
 * @param {string} userId The ID of the user to modify.
 * @param {string} currentStatus The user's current status ('active' or 'blocked').
 */
const toggleUserStatus = (userId, currentStatus) => {
    if (userId === currentUserId) {
        showToast('You cannot block/unblock yourself.', 'warning');
        return;
    }

    const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
    showCustomModal(`Are you sure you want to ${newStatus} this user?`, async () => {
        try {
            const userProfileRef = doc(db, `artifacts/${appId}/users`, userId);
            await updateDoc(userProfileRef, { status: newStatus });
            showToast(`User status updated to ${newStatus}!`, 'success');
            loadUsers();
        } catch (error) {
            console.error("Error updating user status:", error);
            showToast(`Failed to update user status: ${error.message}`, 'error');
        }
    });
};

/**
 * Confirms with the user and then deletes a user's profile and all their associated data in Firestore.
 * Note: This does NOT delete the user from Firebase Authentication as it's not directly exposed
 * through client-side SDK. This would typically be done via a Cloud Function or Admin SDK.
 * @param {string} userId The ID of the user to delete.
 */
const confirmDeleteUser = (userId) => {
    if (userId === currentUserId) {
        showToast('You cannot delete your own profile.', 'warning');
        return;
    }

    showCustomModal('Are you sure you want to delete this user\'s profile and all their data (reviews, comments, votes)? This action cannot be undone and will not delete their Firebase Auth account.', async () => {
        try {
            await runTransaction(db, async (transaction) => {
                const userDocRef = doc(db, `artifacts/${appId}/users`, userId);
                transaction.delete(userDocRef);

                const userReviewsQuery = query(collection(db, `artifacts/${appId}/users/${userId}/userReviews`));
                const userReviewsSnap = await getDocs(userReviewsQuery);
                for (const docSnap of userReviewsSnap.docs) {
                    transaction.delete(doc(db, `artifacts/${appId}/users/${userId}/userReviews`, docSnap.id));
                }

                const userCommentsQuery = query(collection(db, `artifacts/${appId}/users/${userId}/userComments`));
                const userCommentsSnap = await getDocs(userCommentsQuery);
                for (const docSnap of userCommentsSnap.docs) {
                    transaction.delete(doc(db, `artifacts/${appId}/users/${userId}/userComments`, docSnap.id));
                }

                const userVotesQuery = query(collection(db, `artifacts/${appId}/users/${userId}/userVotes`));
                const userVotesSnap = await getDocs(userVotesQuery);
                for (const docSnap of userVotesSnap.docs) {
                    transaction.delete(doc(db, `artifacts/${appId}/users/${userId}/userVotes`, docSnap.id));
                }

                const publicReviewsQuery = query(collection(db, `artifacts/${appId}/reviews`), where('userId', '==', userId));
                const publicReviewsSnap = await getDocs(publicReviewsQuery);
                for (const docSnap of publicReviewsSnap.docs) {
                    transaction.delete(doc(db, `artifacts/${appId}/reviews`, docSnap.id));
                }

                const publicCommentsQuery = query(collection(db, `artifacts/${appId}/comments`), where('userId', '==', userId));
                const publicCommentsSnap = await getDocs(publicCommentsQuery);
                for (const docSnap of publicCommentsSnap.docs) {
                    transaction.delete(doc(db, `artifacts/${appId}/comments`, docSnap.id));
                }
            });

            showToast('User profile and associated data deleted successfully from Firestore!', 'success');
            loadUsers();
        } catch (error) {
            console.error("Error deleting user:", error);
            showToast(`Failed to delete user: ${error.message}`, 'error');
        }
    });
};

// --- Moderation Functions ---

/**
 * Shows the movie reviews moderation section.
 */
const showReviewsModerationSection = () => {
    movieReviewsModerationSection.style.display = 'block';
    commentsModerationSection.style.display = 'none';
    showReviewsModerationBtn.classList.add('active-toggle');
    showCommentsModerationBtn.classList.remove('active-toggle');
    loadReviewsForModeration();
};

/**
 * Shows the news/blog comments moderation section.
 */
const showCommentsModerationSection = () => {
    movieReviewsModerationSection.style.display = 'none';
    commentsModerationSection.style.display = 'block';
    showReviewsModerationBtn.classList.remove('active-toggle');
    showCommentsModerationBtn.classList.add('active-toggle');
    loadCommentsForModeration();
};

/**
 * Loads and displays movie reviews that are pending moderation.
 * NOW LOADS ALL REVIEWS, NOT JUST UNAPPROVED (as reviews are auto-approved in movies.js).
 */
const loadReviewsForModeration = async () => {
    if (!reviewsModerationTableBody) return;

    reviewsModerationTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Loading reviews...</td></tr>';

    try {
        const reviewsRef = collection(db, `artifacts/${appId}/reviews`);
        const q = query(reviewsRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);

        reviewsModerationTableBody.innerHTML = '';

        if (querySnapshot.empty) {
            reviewsModerationTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No movie reviews to display.</td></tr>';
            return;
        }

        const reviewPromises = querySnapshot.docs.map(async (docSnap) => {
            const review = docSnap.data();
            const reviewId = docSnap.id;

            const movieDocRef = doc(db, `artifacts/${appId}/movies`, review.movieId);
            const movieDocSnap = await getDoc(movieDocRef);
            const movieTitle = movieDocSnap.exists() ? movieDocSnap.data().title : 'Unknown Movie';

            const userProfileRef = doc(db, `artifacts/${appId}/users`, review.userId);
            const userProfileSnap = await getDoc(userProfileRef);
            const username = userProfileSnap.exists() ? userProfileSnap.data().username : 'Anonymous User';

            const stars = '⭐'.repeat(review.rating);
            const date = formatDateTime(review.createdAt);

            return {
                id: reviewId,
                username,
                movieTitle,
                rating: stars,
                reviewText: review.reviewText,
                date
            };
        });

        const reviews = await Promise.all(reviewPromises);
        reviews.forEach(review => {
            const row = reviewsModerationTableBody.insertRow();
            row.dataset.reviewId = review.id;
            row.innerHTML = `
                <td>${escapeHtmlAttributeString(review.username)}</td>
                <td>${escapeHtmlAttributeString(review.movieTitle)}</td>
                <td>${escapeHtmlAttributeString(review.rating)}</td>
                <td>
                    <button class="btn small" onclick="viewMessageModal(
                        '${escapeHtmlAttributeString(`Review by ${review.username}`)}',
                        \`${escapeHtmlAttributeString(review.reviewText)}\`,
                        '${escapeHtmlAttributeString(`Movie: ${review.movieTitle}<br>Rating: ${review.rating}<br>Date: ${review.date}`)}'
                    )">View</button>
                </td>
                <td>${escapeHtmlAttributeString(review.date)}</td>
                <td class="actions-buttons">
                    <button class="delete-review-mod-btn btn danger btn-small" data-review-id="${review.id}">Delete</button>
                </td>
            `;
        });

        reviewsModerationTableBody.querySelectorAll('.delete-review-mod-btn').forEach(button => {
            button.addEventListener('click', (event) => confirmDeleteReviewMod(event.target.dataset.reviewId));
        });

    } catch (error) {
        console.error("Error loading reviews for moderation:", error);
        showToast('Failed to load reviews for moderation. Please try again.', 'error');
        reviewsModerationTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Error loading reviews.</td></tr>';
    }
};

/**
 * Confirms with the user and then deletes a movie review from moderation.
 * Deletes from both public and user's private review collections.
 * @param {string} reviewId The ID of the review to delete.
 */
const confirmDeleteReviewMod = (reviewId) => {
    showCustomModal('Are you sure you want to delete this review?', async () => {
        try {
            await runTransaction(db, async (transaction) => {
                const publicReviewRef = doc(db, `artifacts/${appId}/reviews`, reviewId);
                const publicReviewSnap = await transaction.get(publicReviewRef);

                if (!publicReviewSnap.exists()) {
                    throw new Error("Review not found for deletion.");
                }

                transaction.delete(publicReviewRef);

                const userId = publicReviewSnap.data().userId;
                if (userId) {
                    const userPrivateReviewRef = doc(db, `artifacts/${appId}/users/${userId}/userReviews`, reviewId);
                    transaction.delete(userPrivateReviewRef);
                }
            });

            showToast('Review deleted successfully!', 'success');
            loadReviewsForModeration();
        } catch (error) {
            console.error("Error deleting review:", error);
            showToast(`Failed to delete review: ${error.message}`, 'error');
        }
    });
};


/**
 * Loads and displays news/blog comments pending moderation.
 * NOW LOADS ALL COMMENTS, NOT JUST UNAPPROVED.
 */
const loadCommentsForModeration = async () => {
    if (!commentsModerationTableBody) return;

    commentsModerationTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Loading comments...</td></tr>';

    try {
        const commentsRef = collection(db, `artifacts/${appId}/comments`);
        const q = query(commentsRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);

        commentsModerationTableBody.innerHTML = '';

        if (querySnapshot.empty) {
            commentsModerationTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No news/blog comments to display.</td></tr>';
            return;
        }

        const commentPromises = querySnapshot.docs.map(async (docSnap) => {
            const comment = docSnap.data();
            const commentId = docSnap.id;

            let articleTitle = 'Unknown Article';
            try {
                const articleCollectionName = comment.articleType === 'news' ? 'news' : 'blogs';
                const articleDocRef = doc(db, `artifacts/${appId}/${articleCollectionName}`, comment.articleId);
                const articleDocSnap = await getDoc(articleDocRef);
                if (articleDocSnap.exists()) {
                    articleTitle = articleDocSnap.data().title;
                }
            } catch (err) {
                console.warn(`Could not fetch article title for comment ${commentId}:`, err);
            }

            const userProfileRef = doc(db, `artifacts/${appId}/users`, comment.userId);
            const userProfileSnap = await getDoc(userProfileRef);
            const username = userProfileSnap.exists() ? userProfileSnap.data().username : 'Anonymous User';

            const date = formatDateTime(comment.createdAt);

            return {
                id: commentId,
                username,
                contentType: comment.articleType === 'news' ? 'News' : 'Blog',
                articleTitle,
                commentText: comment.commentText,
                date
            };
        });

        const comments = await Promise.all(commentPromises);
        comments.forEach(comment => {
            const row = commentsModerationTableBody.insertRow();
            row.dataset.commentId = comment.id;
            row.innerHTML = `
                <td>${escapeHtmlAttributeString(comment.username)}</td>
                <td>${escapeHtmlAttributeString(comment.contentType)}</td>
                <td>${escapeHtmlAttributeString(comment.articleTitle)}</td>
                <td>
                    <button class="btn small" onclick="viewMessageModal(
                        '${escapeHtmlAttributeString(`Comment by ${comment.username}`)}',
                        \`${escapeHtmlAttributeString(comment.commentText)}\`,
                        '${escapeHtmlAttributeString(`Type: ${comment.contentType}<br>Title: ${comment.articleTitle}<br>Date: ${comment.date}`)}'
                    )">View</button>
                </td>
                <td>${escapeHtmlAttributeString(comment.date)}</td>
                <td class="actions-buttons">
                    <button class="delete-comment-mod-btn btn danger btn-small" data-comment-id="${comment.id}">Delete</button>
                </td>
            `;
        });

        commentsModerationTableBody.querySelectorAll('.delete-comment-mod-btn').forEach(button => {
            button.addEventListener('click', (event) => confirmDeleteCommentMod(event.target.dataset.commentId));
        });

    } catch (error) {
        console.error("Error loading comments for moderation:", error);
        showToast('Failed to load comments for moderation. Please try again.', 'error');
        commentsModerationTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Error loading comments.</td></tr>';
    }
};

/**
 * Confirms with the user and then deletes a news/blog comment from moderation.
 * Deletes from both public and user's private comment collections.
 * @param {string} commentId The ID of the comment to delete.
 */
const confirmDeleteCommentMod = (commentId) => {
    showCustomModal('Are you sure you want to delete this comment?', async () => {
        try {
            await runTransaction(db, async (transaction) => {
                const publicCommentRef = doc(db, `artifacts/${appId}/comments`, commentId);
                const publicCommentSnap = await transaction.get(publicCommentRef);

                if (!publicCommentSnap.exists()) {
                    throw new Error("Comment not found for deletion.");
                }

                transaction.delete(publicCommentRef);

                const userId = publicCommentSnap.data().userId;
                if (userId) {
                    const userPrivateCommentRef = doc(db, `artifacts/${appId}/users/${userId}/userComments`, commentId);
                    transaction.delete(userPrivateCommentRef);
                }
            });

            showToast('Comment deleted successfully!', 'success');
            loadCommentsForModeration();
        } catch (error) {
            console.error("Error deleting comment:", error);
            showToast(`Failed to delete comment: ${error.message}`, 'error');
        }
    });
};

// --- Settings Functions ---

/**
 * Loads the current data retention period setting.
 */
const loadSettings = async () => {
    if (!retentionPeriodInput) return;
    try {
        const settingsDocRef = doc(db, `artifacts/${appId}/settings`, 'retention');
        const settingsSnap = await getDoc(settingsDocRef);
        if (settingsSnap.exists()) {
            retentionPeriodInput.value = settingsSnap.data().days || 365;
        } else {
            retentionPeriodInput.value = 365;
        }
    } catch (error) {
        console.error("Error loading settings:", error);
        showToast('Failed to load settings.', 'error');
    }
};

/**
 * Saves the configured data retention period to Firestore.
 */
const saveRetentionSettings = async () => {
    if (!retentionPeriodInput) return;
    const days = parseInt(retentionPeriodInput.value);
    if (isNaN(days) || days < 0) {
        showToast('Please enter a valid number of days for retention (0 or more).', 'warning');
        return;
    }
    try {
        const settingsDocRef = doc(db, `artifacts/${appId}/settings`, 'retention');
        await setDoc(settingsDocRef, { days: days }, { merge: true });
        showToast('Retention settings saved successfully!', 'success');
    } catch (error) {
        console.error("Error saving settings:", error);
        showToast(`Failed to save settings: ${error.message}`, 'error');
    }
};

/**
 * Triggers a manual cleanup process for old reviews and comments based on the configured retention period.
 */
const triggerManualCleanup = () => {
    showCustomModal('Are you sure you want to trigger a manual data cleanup? This will permanently delete reviews and comments older than the configured retention period. This action cannot be undone.', async () => {
        cleanupStatus.textContent = 'Cleanup in progress... This may take a while.';
        cleanupStatus.style.color = 'var(--info-color)';

        const retentionDays = parseInt(retentionPeriodInput.value || 365);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

        let cleanedCount = 0;
        let errorCount = 0;

        try {
            const oldReviewsQuery = query(collection(db, `artifacts/${appId}/reviews`), where('createdAt', '<', cutoffTimestamp));
            const oldReviewsSnap = await getDocs(oldReviewsQuery);
            for (const docSnap of oldReviewsSnap.docs) {
                try {
                    await deleteDoc(doc(db, `artifacts/${appId}/reviews`, docSnap.id));
                    const userIdFromReview = docSnap.data().userId;
                    if (userIdFromReview) {
                        await deleteDoc(doc(db, `artifacts/${appId}/users/${userIdFromReview}/userReviews`, docSnap.id));
                    }
                    cleanedCount++;
                } catch (e) {
                    console.error("Error deleting old review during cleanup:", e);
                    errorCount++;
                }
            }

            const oldCommentsQuery = query(collection(db, `artifacts/${appId}/comments`), where('createdAt', '<', cutoffTimestamp));
            const oldCommentsSnap = await getDocs(oldCommentsQuery);
            for (const docSnap of oldCommentsSnap.docs) {
                try {
                    await deleteDoc(doc(db, `artifacts/${appId}/comments`, docSnap.id));
                    const userIdFromComment = docSnap.data().userId;
                    if (userIdFromComment) {
                        await deleteDoc(doc(db, `artifacts/${appId}/users/${userIdFromComment}/userComments`, docSnap.id));
                    }
                    cleanedCount++;
                } catch (e) {
                    console.error("Error deleting old comment during cleanup:", e);
                    errorCount++;
                }
            }

            cleanupStatus.textContent = `Cleanup finished: ${cleanedCount} items deleted. ${errorCount} errors.`;
            cleanupStatus.style.color = 'var(--success-color)';
            showToast(`Cleanup completed: ${cleanedCount} items deleted!`, 'success');

        } catch (error) {
            console.error("Error during manual cleanup:", error);
            cleanupStatus.textContent = `Cleanup failed: ${error.message}`;
            cleanupStatus.style.color = 'var(--error-color)';
            showToast(`Manual cleanup failed: ${error.message}`, 'error');
        }
    });
};

/**
 * Global function to display messages in a modal. Made global for inline HTML onclick.
 * @param {string} title The title of the message modal.
 * @param {string} message The main message content.
 * @param {string} details Additional details to display.
 */
// ✅ Updated viewMessageModal in dashboard.js
function viewMessageModal(title, message, details) {
    const modal = document.getElementById('message-viewer-modal');
    const modalTitle = document.getElementById('message-viewer-title');
    const modalContent = document.getElementById('message-viewer-content');

    modalTitle.textContent = title;

    // Clear old content
    modalContent.innerHTML = "";

    // Add details in bold
    const strong = document.createElement("strong");
    strong.textContent = details;
    modalContent.appendChild(strong);

    modalContent.appendChild(document.createElement("br"));
    modalContent.appendChild(document.createElement("br"));

    // Add message (preserve line breaks safely)
    const msg = document.createElement("p");
    msg.textContent = message;
    msg.style.whiteSpace = "pre-wrap"; // ✅ preserves newlines
    modalContent.appendChild(msg);

    modal.style.display = 'flex';
}
window.viewMessageModal = viewMessageModal;


async function loadFeedbackEntries() {
    const tableBody = document.querySelector("#feedback-table tbody");
    tableBody.innerHTML = "<tr><td colspan='6'>Loading...</td></tr>";

    try {
        const querySnapshot = await getDocs(
            query(collection(db, `artifacts/${appId}/feedback`), orderBy("createdAt", "desc"))
        );
        tableBody.innerHTML = "";

        if (querySnapshot.empty) {
            tableBody.innerHTML = "<tr><td colspan='6'>No feedback found.</td></tr>";
            return;
        }

        querySnapshot.forEach(docSnap => {
            const d = docSnap.data();
            const rawDate = d.createdAt?.toDate?.();
            const date = rawDate ? formatDateTime(rawDate) : 'No Date';
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${escapeHtmlAttributeString(date)}</td>
                <td>${escapeHtmlAttributeString(d.name || "Anonymous")}</td>
                <td>${escapeHtmlAttributeString(d.email || "-")}</td>
                <td>${escapeHtmlAttributeString(d.subject || "-")}</td>
                <td><button class="btn small" onclick="viewMessageModal(
                    '${escapeHtmlAttributeString(`Feedback from ${d.name || "Anonymous"}`)}',
                    \`${escapeHtmlAttributeString(d.message)}\`,
                    '${escapeHtmlAttributeString(`Email: ${d.email || 'N/A'}`)}'
                )">View</button></td>
                <td><button class="btn danger small" onclick="confirmDeleteFeedback('${docSnap.id}')">Delete</button></td>
            `;
            tableBody.appendChild(row);
        });
    } catch (err) {
        console.error("Error loading feedback entries:", err);
        showToast("Failed to load feedback.", "error");
    }
}
window.loadFeedbackEntries = loadFeedbackEntries;

const confirmDeleteFeedback = (feedbackId) => {
    showCustomModal('Are you sure you want to delete this feedback entry?', async () => {
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/feedback`, feedbackId));
            showToast('Feedback entry deleted successfully!', 'success');
            loadFeedbackEntries();
        } catch (error) {
            console.error("Error deleting feedback entry:", error);
            showToast(`Failed to delete feedback entry: ${error.message}`, 'error');
        }
    });
};

async function loadPromotionInquiries() {
    const tableBody = document.querySelector("#promotion-inquiries-table tbody");
    tableBody.innerHTML = "<tr><td colspan='7'>Loading...</td></tr>";

    try {
        const querySnapshot = await getDocs(
            query(collection(db, `artifacts/${appId}/promotion_inquiries`), orderBy("createdAt", "desc"))
        );
        tableBody.innerHTML = "";

        if (querySnapshot.empty) {
            tableBody.innerHTML = "<tr><td colspan='7'>No promotion inquiries found.</td></tr>";
            return;
        }

        querySnapshot.forEach(docSnap => {
            const d = docSnap.data();
            const rawDate = d.createdAt?.toDate?.();
            const date = rawDate ? formatDateTime(rawDate) : 'No Date';
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${escapeHtmlAttributeString(date)}</td>
                <td>${escapeHtmlAttributeString(d.name || "-")}</td>
                <td>${escapeHtmlAttributeString(d.company || "-")}</td>
                <td>${escapeHtmlAttributeString(d.email || "-")}</td>
                <td>${escapeHtmlAttributeString(d.mobile || "-")}</td>
                <td>
                    <button class="btn small" onclick="viewMessageModal(
                        '${escapeHtmlAttributeString(`Promotion Inquiry from ${d.name || 'N/A'}`)}',
                        \`${escapeHtmlAttributeString(d.message)}\`,
                        '${escapeHtmlAttributeString(`Email: ${d.email || 'N/A'}<br>Company: ${d.company || 'N/A'}<br>Mobile: ${d.mobile || 'N/A'}`)}'
                    )">View</button>
                </td>
                <td>
                    <button class="btn danger small" onclick="confirmDeletePromotionInquiry('${docSnap.id}')">Delete</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (err) {
        console.error("Error loading promotion inquiries:", err);
        showToast("Failed to load promotion inquiries.", "error");
    }
}
window.loadPromotionInquiries = loadPromotionInquiries;

const confirmDeletePromotionInquiry = (inquiryId) => {
    showCustomModal('Are you sure you want to delete this promotion inquiry?', async () => {
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/promotion_inquiries`, inquiryId));
            showToast('Promotion inquiry deleted successfully!', 'success');
            loadPromotionInquiries();
        } catch (error) {
            console.error("Error deleting promotion inquiry:", error);
            showToast(`Failed to delete promotion inquiry: ${error.message}`, 'error');
        }
    });
};


// --- Initialization and Event Listeners Setup ---

// This function runs once the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.modal .close-button').forEach(button => {
        button.addEventListener('click', (event) => {
            event.target.closest('.modal').style.display = 'none';
            currentEditItemId = null;
        });
    });

    window.addEventListener('click', (event) => {
        // Close movie cast suggestions if click is outside
        if (celebritySuggestionsDiv && event.target !== movieCastInput && event.target.parentNode !== celebritySuggestionsDiv) {
            celebritySuggestionsDiv.style.display = 'none';
        }
        // Close nominee celebrity suggestions if click is outside
        if (nomineeCelebritySuggestionsDiv && event.target !== nomineeCelebritySearchInput && event.target.parentNode !== nomineeCelebritySuggestionsDiv) {
            nomineeCelebritySuggestionsDiv.style.display = 'none';
        }

        document.querySelectorAll('.modal').forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
                currentEditItemId = null;
            }
        });
    });

    const checkAdminAccess = () => {
        if (isAuthReady) {
            if (!currentUser || userRole !== 'admin') {
                showToast('Access Denied: You must be an administrator to view this page.', 'error');
                window.location.href = 'index.html';
                return;
            }
            setupDashboard();
        } else {
            setTimeout(checkAdminAccess, 100);
        }
    };
    checkAdminAccess();
});

const setupDashboard = () => {
    movieFormModal.style.display = 'none';
    newsFormModal.style.display = 'none';
    blogFormModal.style.display = 'none';
    celebrityFormModal.style.display = 'none';
    categoryFormModal.style.display = 'none';
    nomineeFormModal.style.display = 'none';
    if (celebritySuggestionsDiv) {
        celebritySuggestionsDiv.style.display = 'none';
    }
    if (nomineeCelebritySuggestionsDiv) {
        nomineeCelebritySuggestionsDiv.style.display = 'none';
    }


    sidebarNav?.addEventListener('click', switchTab);

    document.querySelector('.dashboard-nav li[data-tab="movies-management"]')?.click();

    // Movie Management Listeners
    addMovieBtn?.addEventListener('click', addMovie);
    movieForm?.addEventListener('submit', handleMovieFormSubmit);
    addCastMemberToMovieBtn?.addEventListener('click', () => {
        if (movieCastInput.value.trim()) {
            addCastMember({ id: movieCastInput.value.trim().toLowerCase().replace(/\s/g, '-'), name: movieCastInput.value.trim() });
        }
    });
    movieCastInput?.addEventListener('input', (event) => {
        searchCelebrities(event.target.value);
    });
    movieCastInput?.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            if (movieCastInput.value.trim()) {
                addCastMember({ id: movieCastInput.value.trim().toLowerCase().replace(/\s/g, '-'), name: movieCastInput.value.trim() });
                celebritySuggestionsDiv.style.display = 'none';
            }
        }
    });
    movieSearchBtn?.addEventListener('click', () => loadMoviesForAdmin(movieSearchInput.value));
    movieSearchInput?.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            loadMoviesForAdmin(movieSearchInput.value);
        }
    });

    // Celebrity Management Listeners
    addCelebrityBtn?.addEventListener('click', addCelebrity);
    celebrityForm?.addEventListener('submit', handleCelebrityFormSubmit);
    celebritySearchBtn?.addEventListener('click', () => loadCelebritiesForAdmin(celebritySearchInput.value));
    celebritySearchInput?.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            loadCelebritiesForAdmin(celebritySearchInput.value);
        }
    });

    // Content Management Listeners (News & Blogs)
    showNewsBtn?.addEventListener('click', showNewsSection);
    showBlogsBtn?.addEventListener('click', showBlogsSection);
    addNewsBtn?.addEventListener('click', addNews);
    addBlogBtn?.addEventListener('click', addBlog);
    newsForm?.addEventListener('submit', handleNewsFormSubmit);
    blogForm?.addEventListener('submit', handleBlogFormSubmit);

    // Awards Management Listeners
    adminAwardsIndustrySelector?.addEventListener('change', (event) => loadAdminAwardsCategories(event.target.value));
    addCategoryBtn?.addEventListener('click', addCategory);
    categoryForm?.addEventListener('submit', handleCategoryFormSubmit);
    addNomineeBtn?.addEventListener('click', addNominee);
    nomineeForm?.addEventListener('submit', handleNomineeFormSubmit);

    // Nominee Search & Add listeners
    if (nomineeCelebritySearchInput) {
        nomineeCelebritySearchInput.addEventListener('input', (event) => {
            searchNomineeCelebrities(event.target.value);
        });
        nomineeCelebritySearchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                if (nomineeCelebritySearchInput.value.trim() && !selectedNomineeCelebrity) {
                    document.getElementById('nominee-name').value = nomineeCelebritySearchInput.value.trim();
                    document.getElementById('nominee-description').value = ''; // Clear description
                    currentNomineePhotoPreview.style.display = 'none';
                    currentNomineePhotoPreview.src = '';
                    selectedNomineeCelebrity = { id: nomineeCelebritySearchInput.value.trim().toLowerCase().replace(/\s/g, '-'), name: nomineeCelebritySearchInput.value.trim(), imageUrl: null };
                    document.getElementById('nominee-photo').value = ''; // Clear file input
                }
                nomineeCelebritySuggestionsDiv.style.display = 'none';
            }
        });
    }
    if (addNomineeCelebrityBtn) {
        addNomineeCelebrityBtn.addEventListener('click', () => {
            document.getElementById('nominee-name').value = nomineeCelebritySearchInput.value.trim();
            document.getElementById('nominee-description').value = ''; // Clear description
            currentNomineePhotoPreview.style.display = 'none';
            currentNomineePhotoPreview.src = '';
            selectedNomineeCelebrity = { id: nomineeCelebritySearchInput.value.trim().toLowerCase().replace(/\s/g, '-'), name: nomineeCelebritySearchInput.value.trim(), imageUrl: null };
            nomineeCelebritySuggestionsDiv.style.display = 'none';
            document.getElementById('nominee-photo').value = ''; // Clear file input
            showToast('Manually added nominee. Upload photo or search for an existing celebrity.', 'info');
        });
    }

    backToCategoriesBtn?.addEventListener('click', () => {
        nomineesSection.style.display = 'none';
        categoriesSection.style.display = 'block';
        currentNomineeCategoryId = null;
        currentCategoryNameSpan.textContent = '';
        loadAdminAwardsCategories(adminAwardsIndustrySelector.value);
    });

    // User Management Listeners
    userSearchBtn?.addEventListener('click', () => loadUsers(userSearchInput.value));
    userSearchInput?.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            loadUsers(userSearchInput.value);
        }
    });

    // Moderation Listeners
    showReviewsModerationBtn?.addEventListener('click', showReviewsModerationSection);
    showCommentsModerationBtn?.addEventListener('click', showCommentsModerationSection);

    // Settings Listeners
    saveRetentionBtn?.addEventListener('click', saveRetentionSettings);
    triggerCleanupBtn?.addEventListener('click', triggerManualCleanup);
};

async function uploadImageToHostinger(file, fileName = '') {
    const formData = new FormData();
    formData.append('file', file);

    const url = `https://www.moviereporter.in/upload.php?token=abc123`;

    try {
        const res = await fetch(url, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        return data.url;
    } catch (err) {
        console.error("Upload failed:", err);
        return null;
    }
}


async function deleteImageFromHostinger(imageUrl) {
  const formData = new FormData();
  formData.append('action', 'delete');
  formData.append('url', imageUrl);

  const url = `https://www.moviereporter.in/upload.php?token=abc123`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    console.log("Image deleted:", data.message);
    return true;
  } catch (err) {
    console.error("Failed to delete image:", err);
    return false;
  }
}