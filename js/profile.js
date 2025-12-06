// js/profile.js

import { db, auth, currentUser, currentUserId, isAuthReady, userRole } from './firebase-init.js';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc, orderBy, limit, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, showCustomModal, formatDate, formatDateTime } from './utils.js';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Get app ID from global variable
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// DOM Elements
const profileDetailsCard = document.getElementById('profile-details'); // Overall profile card
const editProfileButton = document.getElementById('edit-profile-btn');
const changePasswordButton = document.getElementById('change-password-btn');

// NEW: Edit Profile Modal Elements
const editProfileModal = document.getElementById('edit-profile-modal');
const closeEditProfileModalBtn = document.getElementById('close-edit-profile-modal');
const editProfileForm = document.getElementById('edit-profile-form');
const editUsernameInput = document.getElementById('edit-username');
const editMobileInput = document.getElementById('edit-mobile');
const editEmailInput = document.getElementById('edit-email'); // This will be disabled
const editUsernameStatusMessage = document.getElementById('edit-username-status-message'); // For username availability

// NEW: Change Password Modal Elements
const changePasswordModal = document.getElementById('change-password-modal');
const closeChangePasswordModalBtn = document.getElementById('close-change-password-modal');
const changePasswordForm = document.getElementById('change-password-form');
const currentPasswordInput = document.getElementById('current-password');
const newPasswordInput = document.getElementById('new-password');
const confirmNewPasswordInput = document.getElementById('confirm-new-password');

const userCommentsContainer = document.getElementById('my-comments-list');
const userVotesContainer = document.getElementById('my-votes-list');
const myReviewsList = document.getElementById('my-reviews-list'); // Added for user ratings list

// Edit Comment Modal Elements
const editCommentModal = document.getElementById('edit-comment-modal');
const editCommentForm = document.getElementById('edit-comment-form');
const editCommentText = document.getElementById('edit-comment-text');

// Review Modal Logic (for editing user's reviews from profile)
const editReviewModal = document.getElementById('edit-review-modal');
const editReviewForm = document.getElementById('edit-review-form');
const editReviewText = document.getElementById('edit-review-text');

// Global variables for current comment/review being edited
let currentEditCommentId = null;
let currentEditCommentArticleId = null;
let currentEditCommentArticleType = null;
let currentEditReviewId = null; // For the user's movie reviews
let currentEditMovieId = null; // For the user's movie reviews

let usernameCheckTimeout; // For debouncing the username check in edit profile modal

const startCountdownTimer = (elementId, releaseDate) => {
  const target = document.getElementById(elementId);
  if (!target) return;

  const update = () => {
    const now = new Date().getTime();
    const distance = releaseDate.getTime() - now;

    if (distance <= 0) {
      target.textContent = "Released!";
      clearInterval(interval);
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((distance / (1000 * 60)) % 60);
    const seconds = Math.floor((distance / 1000) % 60);

    target.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  update(); // Initial call
  const interval = setInterval(update, 1000);
};

// Generic spinner HTML (Tailwind CSS based)
const spinnerHtml = `
    <div class="flex justify-center items-center py-10 w-full">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100"></div>
    </div>
`;


/**
 * Helper function to check if a string is a valid email format.
 * @param {string} str The string to validate.
 * @returns {boolean} True if it's a valid email, false otherwise.
 */
const isValidEmail = (str) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
};

/**
 * Helper function to check if a string looks like a valid mobile number format.
 * Requires a minimum of 10 digits.
 * @param {string} str The string to validate.
 * @returns {boolean} True if it's a valid mobile number, false otherwise.
 */
const isValidMobileNumber = (str) => {
    return /^\+?[0-9]{10,15}$/.test(str);
};

/**
 * Checks if a username is already taken in Firestore (for edit profile modal).
 * @param {string} username The username to check.
 * @returns {Promise<boolean>} True if available, false if taken.
 */
const checkEditUsernameAvailability = async (username) => {
    // If the username is the current user's existing username, it's always "available" for them.
    // This prevents showing "taken" if they just save without changing their username.
    if (currentUser && currentUser.displayName === username) {
        editUsernameStatusMessage.textContent = ''; // Clear message
        return true;
    }

    editUsernameStatusMessage.textContent = 'Checking availability...';
    editUsernameStatusMessage.style.color = 'var(--info-color)';

    if (username.length < 3) {
        editUsernameStatusMessage.textContent = 'Username must be at least 3 characters.';
        editUsernameStatusMessage.style.color = 'var(--warning-color)';
        return false;
    }

    try {
        const usersRef = collection(db, `artifacts/${appId}/users`);
        const q = query(usersRef, where('username', '==', username), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            editUsernameStatusMessage.textContent = 'Username is available!';
            editUsernameStatusMessage.style.color = 'var(--success-color)';
            return true;
        } else {
            editUsernameStatusMessage.textContent = 'Username is already taken.';
            editUsernameStatusMessage.style.color = 'var(--error-color)';
            return false;
        }
    } catch (error) {
        console.error("Error checking username availability:", error);
        editUsernameStatusMessage.textContent = 'Error checking username. Please try again.';
        editUsernameStatusMessage.style.color = 'var(--error-color)';
        return false;
    }
};


/**
 * Loads and displays the current user's profile information.
 */
const loadUserProfile = async () => {
    if (!currentUser || !currentUserId) {
        showToast('Please login to view your profile.', 'info');
        window.location.href = 'login.html';
        return;
    }

    if (profileDetailsCard) {
        profileDetailsCard.innerHTML = spinnerHtml; // Show spinner while loading profile
    }


    try {
        const userProfileRef = doc(db, `artifacts/${appId}/users`, currentUserId);
        const userProfileSnap = await getDoc(userProfileRef);

        if (userProfileSnap.exists()) {
            const profileData = userProfileSnap.data();
            const memberSinceDate = profileData.createdAt ? formatDateTime(profileData.createdAt) : 'N/A';

            if (profileDetailsCard) {
                profileDetailsCard.innerHTML = `
                    <p><strong>Username:</strong> <span id="display-username">${profileData.username || 'N/A'}</span></p>
                    <p><strong>Email:</strong> <span id="display-email">${currentUser.email || 'N/A'}</span></p>
                    <p><strong>Mobile:</strong> <span id="display-mobile">${profileData.mobileNumber || 'N/A'}</span></p>
                    <p><strong>Role:</strong> <span id="display-role">${profileData.role || 'User'}</span></p>
                    <p><strong>Member Since:</strong> <span id="display-member-since">${memberSinceDate}</span></p>
                `;
            }

            // Pre-fill edit modal inputs
            if (editUsernameInput) editUsernameInput.value = profileData.username || '';
            if (editMobileInput) editMobileInput.value = profileData.mobileNumber || '';
            if (editEmailInput) {
                editEmailInput.value = currentUser.email || '';
                editEmailInput.disabled = true; // Email is not editable through this form
            }
        } else {
            showToast('User profile data not found.', 'warning');
            if (profileDetailsCard) {
                profileDetailsCard.innerHTML = '<p class="no-data-message">Error loading profile data. Please try again.</p>';
            }
        }

        // Load user-related content
        loadUserComments();
        loadUserVotes();
        loadUserRatings();
        loadInterestedMovies(); // ✅ This is correct!
        loadSavedBlogs();

    } catch (error) {
        console.error("Error loading user profile:", error);
        showToast('Failed to load profile data.', 'error');
        if (profileDetailsCard) {
            profileDetailsCard.innerHTML = '<p class="no-data-message">Error loading profile data. Please try again.</p>';
        }
    }
};


/**
 * Handles updating the user's profile (username and mobile number).
 */
const handleUpdateProfile = async (event) => {
    event.preventDefault();

    if (!currentUser || !currentUserId) {
        showToast('You must be logged in to update your profile.', 'error');
        return;
    }

    const newUsername = editUsernameInput.value.trim();
    const newMobileNumber = editMobileInput.value.trim();

    if (!newUsername || !newMobileNumber) {
        showToast('Username and Mobile Number cannot be empty.', 'warning');
        return;
    }

    if (newUsername.length < 3) {
        showToast('Username must be at least 3 characters.', 'warning');
        return;
    }

    if (!isValidMobileNumber(newMobileNumber)) {
        showToast('Please enter a valid mobile number (10-15 digits, optional + prefix).', 'error');
        return;
    }

    // Check if username is truly available (if it changed and is not the current user's original username)
    if (newUsername !== currentUser.displayName) {
        const isUsernameAvailable = await checkEditUsernameAvailability(newUsername);
        if (!isUsernameAvailable) {
            showToast('Please choose an available username.', 'error');
            return;
        }
    }

    try {
        // Update Firebase Auth displayName
        await updateProfile(currentUser, { displayName: newUsername });

        // Update user profile in Firestore
        const userProfileRef = doc(db, `artifacts/${appId}/users`, currentUserId);
        await updateDoc(userProfileRef, {
            username: newUsername,
            mobileNumber: newMobileNumber
        });

        showToast('Profile updated successfully!', 'success');
        editProfileModal.style.display = 'none'; // Close modal
        loadUserProfile(); // Reload profile to update displayed data

    } catch (error) {
        console.error("Error updating profile:", error);
        showToast(`Failed to update profile: ${error.message}`, 'error');
    }
};

/**
 * Handles changing the user's password.
 */
const handleChangePassword = async (event) => {
    event.preventDefault();

    if (!currentUser) {
        showToast('You must be logged in to change your password.', 'error');
        return;
    }

    const currentPassword = currentPasswordInput.value.trim();
    const newPassword = newPasswordInput.value.trim();
    const confirmNewPassword = confirmNewPasswordInput.value.trim();

    if (!currentPassword || !newPassword || !confirmNewPassword) {
        showToast('Please fill in all password fields.', 'warning');
        return;
    }
    if (newPassword !== confirmNewPassword) {
        showToast('New passwords do not match.', 'error');
        return;
    }
    if (newPassword.length < 6) {
        showToast('New password should be at least 6 characters.', 'warning');
        return;
    }
    if (currentPassword === newPassword) {
        showToast('New password cannot be the same as the current password.', 'warning');
        return;
    }

    try {
        // Re-authenticate user with their current credentials
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);

        // Update the password
        await updatePassword(currentUser, newPassword);

        showToast('Password updated successfully! Please re-login with your new password.', 'success');
        changePasswordModal.style.display = 'none'; // Close modal
        currentPasswordInput.value = ''; // Clear fields
        newPasswordInput.value = '';
        confirmNewPasswordInput.value = '';
        // Optionally, force logout to ensure new session with new password
        await auth.signOut();
        window.location.href = 'login.html';

    } catch (error) {
        console.error("Error changing password:", error);
        let errorMessage = 'Failed to change password.';
        switch (error.code) {
            case 'auth/wrong-password':
                errorMessage = 'Current password is incorrect.';
                break;
            case 'auth/user-mismatch':
            case 'auth/invalid-credential':
                errorMessage = 'Authentication failed. Please check your current password.';
                break;
            case 'auth/weak-password':
                errorMessage = 'The new password is too weak.';
                break;
            case 'auth/requires-recent-login':
                errorMessage = 'This action requires a recent login. Please log in again and try.';
                await auth.signOut(); // Force logout
                window.location.href = 'login.html';
                break;
            default:
                errorMessage = `Failed to change password: ${error.message}`;
                break;
        }
        showToast(errorMessage, 'error');
    }
};


/**
 * Loads and displays the current user's comments on news/blogs.
 */
const loadUserComments = async () => {
    if (!userCommentsContainer || !currentUserId) {
        return;
    }

    userCommentsContainer.innerHTML = spinnerHtml; // Show spinner

    try {
        const commentsRef = collection(db, `artifacts/${appId}/users/${currentUserId}/userComments`);
        const q = query(commentsRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            userCommentsContainer.innerHTML = '<p>You haven\'t posted any comments yet.</p>';
            return;
        }

        userCommentsContainer.innerHTML = '';
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

            const date = formatDateTime(comment.createdAt);

            return `
                <div class="user-list-item comment-card p-4 border rounded shadow-sm mb-4" data-comment-id="${commentId}" aria-label="Comment on ${comment.articleType === 'news' ? 'News' : 'Blog'} titled ${articleTitle}">
                    <p class="item-title text-lg font-semibold mb-1">Comment on ${comment.articleType === 'news' ? 'News' : 'Blog'}: "<span class="text-primary-600">${articleTitle}</span>"</p>
                    <p class="item-meta text-sm text-gray-600 mb-2">Date: ${date}</p>
                    <p class="item-content text-gray-800 mb-3">${comment.commentText}</p>
                    <div class="item-actions flex gap-2">
                        <button class="edit-user-comment-btn btn secondary btn-small py-1 px-3 rounded"
                                data-comment-id="${commentId}"
                                data-article-id="${comment.articleId}"
                                data-article-type="${comment.articleType}"
                                data-comment-text="${comment.commentText}"
                                aria-label="Edit this comment">Edit</button>
                        <button class="delete-user-comment-btn btn danger btn-small py-1 px-3 rounded" data-comment-id="${commentId}" aria-label="Delete this comment">Delete</button>
                    </div>
                </div>
            `;
        });

        const commentItems = await Promise.all(commentPromises);
        commentItems.forEach(item => userCommentsContainer.insertAdjacentHTML('beforeend', item));

        userCommentsContainer.querySelectorAll('.edit-user-comment-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const commentId = event.target.dataset.commentId;
                const articleId = event.target.dataset.articleId;
                const articleType = event.target.dataset.articleType;
                const text = event.target.dataset.commentText;
                editUserComment(commentId, articleId, articleType, text);
            });
        });
        userCommentsContainer.querySelectorAll('.delete-user-comment-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const commentId = event.target.dataset.commentId;
                confirmDeleteUserComment(commentId);
            });
        });

    } catch (error) {
        console.error("Error loading user comments:", error);
        showToast('Failed to load your comments.', 'error');
        userCommentsContainer.innerHTML = '<p>Error loading your comments. Please try again.</p>';
    }
};

/**
 * Handles editing a user's comment directly on the profile page.
 * Opens a modal to edit the comment.
 * @param {string} commentId ID of the comment to edit.
 * @param {string} articleId ID of the article the comment belongs to.
 * @param {string} articleType Type of the article ('news' or 'blog').
 * @param {string} text Current comment text.
 */
const editUserComment = (commentId, articleId, articleType, text) => {
    currentEditCommentId = commentId;
    currentEditCommentArticleId = articleId;
    currentEditCommentArticleType = articleType;

    editCommentText.value = text;
    editCommentModal.style.display = 'flex';
    editCommentText.focus(); // Focus on the textarea when modal opens
};

/**
 * Handles the submission of the edited comment from the profile page modal.
 */
const handleEditCommentSubmit = async (event) => {
    event.preventDefault();

    if (!currentUser || !currentUserId) {
        showToast('You must be logged in to update your comment.', 'error');
        return;
    }
    if (!currentEditCommentId) {
        showToast('No comment selected for editing.', 'error');
        return;
    }

    const updatedCommentText = editCommentText.value.trim();
    if (updatedCommentText === '') {
        showToast('Comment cannot be empty.', 'warning');
        return;
    }

    try {
        console.log("Attempting to update comment:");
        console.log("  Comment ID:", currentEditCommentId);
        console.log("  Current User ID:", currentUserId);
        console.log("  Public Comment Path:", `artifacts/${appId}/comments/${currentEditCommentId}`);
        console.log("  Private Comment Path:", `artifacts/${appId}/users/${currentUserId}/userComments/${currentEditCommentId}`);

        // Update the public comment
        const publicCommentRef = doc(db, `artifacts/${appId}/comments`, currentEditCommentId);
        await updateDoc(publicCommentRef, {
            commentText: updatedCommentText,
            createdAt: Timestamp.now(), // Update timestamp on edit
            // Ensure userId field exists in public comment if your create rule for comments
            // expects request.resource.data.userId == request.auth.uid
            userId: currentUserId, // Explicitly set/update userId to ensure rule passes
            approved: true
        });

        // Update the user's private comment reference
        const userPrivateCommentRef = doc(db, `artifacts/${appId}/users/${currentUserId}/userComments`, currentEditCommentId);
        await updateDoc(userPrivateCommentRef, {
            commentText: updatedCommentText,
            createdAt: Timestamp.now(),
            approved: true
        });

        showToast('Comment updated successfully!', 'success');
        editCommentModal.style.display = 'none';
        loadUserComments();

    } catch (error) {
        console.error("Error updating comment from profile:", error);
        showToast(`Failed to update comment: ${error.message}`, 'error');
    }
};


/**
 * Confirms and deletes a user's comment.
 * @param {string} commentId The ID of the comment to delete.
 */
const confirmDeleteUserComment = (commentId) => {
    showCustomModal('Are you sure you want to delete this comment? This action cannot be undone.', async () => {
        try {
            console.log("Attempting to delete comment:");
            console.log("  Comment ID:", commentId);
            console.log("  Current User ID:", currentUserId);
            console.log("  Public Comment Path:", `artifacts/${appId}/comments/${commentId}`);
            console.log("  Private Comment Path:", `artifacts/${appId}/users/${currentUserId}/userComments/${commentId}`);

            await deleteDoc(doc(db, `artifacts/${appId}/comments`, commentId));
            await deleteDoc(doc(db, `artifacts/${appId}/users/${currentUserId}/userComments`, commentId));
            showToast('Comment deleted successfully!', 'success');
            loadUserComments();
        } catch (error) {
            console.error("Error deleting comment:", error);
            showToast(`Failed to delete comment: ${error.message}`, 'error');
        }
    });
};

/**
 * Loads and displays the current user's award votes.
 */
const loadUserVotes = async () => {
    if (!userVotesContainer || !currentUserId) {
        return;
    }

    userVotesContainer.innerHTML = spinnerHtml; // Show spinner

    try {
        const votesRef = collection(db, `artifacts/${appId}/users/${currentUserId}/userVotes`);
        const q = query(votesRef, orderBy('votedAt', 'desc'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            userVotesContainer.innerHTML = '<p>You haven\'t cast any votes yet.</p>';
            return;
        }

        userVotesContainer.innerHTML = '';
        const votePromises = querySnapshot.docs.map(async (docSnap) => {
            const vote = docSnap.data();
            const voteId = docSnap.id;

            let categoryName = 'Unknown Category';
            let nomineeName = 'Unknown Nominee';
            let nomineePhoto = 'https://placehold.co/50x50/333/eee?text=Photo';
            let industry = 'N/A';

            try {
                const categoryDocRef = doc(db, `artifacts/${appId}/categories`, vote.categoryId);
                const categoryDocSnap = await getDoc(categoryDocRef);
                if (categoryDocSnap.exists()) {
                    categoryName = categoryDocSnap.data().name;
                    industry = categoryDocSnap.data().industry || 'N/A';
                }

                const nomineeDocRef = doc(db, `artifacts/${appId}/nominees`, vote.nomineeId);
                const nomineeDocSnap = await getDoc(nomineeDocRef);
                if (nomineeDocSnap.exists()) {
                    nomineeName = nomineeDocSnap.data().name;
                    nomineePhoto = nomineeDocSnap.data().photoUrl || nomineePhoto;
                }
            } catch (err) {
                console.warn(`Could not fetch details for vote ${voteId}:`, err);
            }

            const date = formatDateTime(vote.votedAt);

            return `
                <div class="user-list-item vote-card p-4 border rounded shadow-sm mb-4 flex items-center gap-4" data-vote-id="${voteId}" aria-label="Vote for ${nomineeName} in category ${categoryName}">
                    <img src="${nomineePhoto}" alt="${nomineeName}" class="w-16 h-16 rounded-full object-cover border border-gray-300" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/64x64/333/eee?text=Photo';">
                    <div class="vote-item-info flex-grow">
                        <p class="item-title text-lg font-semibold">Voted for: <strong class="text-primary-600">${nomineeName}</strong></p>
                        <p class="item-meta text-sm text-gray-600">Category: ${categoryName} (${industry})</p>
                        <p class="item-meta text-sm text-gray-600">Voted On: ${date}</p>
                    </div>
                    <!-- Votes cannot be changed/deleted by user after casting for integrity -->
                </div>
            `;
        });

        const voteItems = await Promise.all(votePromises);
        voteItems.forEach(item => userVotesContainer.insertAdjacentHTML('beforeend', item));

    } catch (error) {
        console.error("Error loading user votes:", error);
        showToast('Failed to load your votes.', 'error');
        userVotesContainer.innerHTML = '<p>Error loading your votes. Please try again.</p>';
    }
};


// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Set accessibility attributes for modals
    if (editProfileModal) {
        editProfileModal.setAttribute('role', 'dialog');
        editProfileModal.setAttribute('aria-modal', 'true');
        editProfileModal.setAttribute('aria-labelledby', 'edit-profile-modal-title');
    }
    if (changePasswordModal) {
        changePasswordModal.setAttribute('role', 'dialog');
        changePasswordModal.setAttribute('aria-modal', 'true');
        changePasswordModal.setAttribute('aria-labelledby', 'change-password-modal-title');
    }
    if (editCommentModal) {
        editCommentModal.setAttribute('role', 'dialog');
        editCommentModal.setAttribute('aria-modal', 'true');
        editCommentModal.setAttribute('aria-labelledby', 'edit-comment-modal-title');
    }
    if (editReviewModal) {
        editReviewModal.setAttribute('role', 'dialog');
        editReviewModal.setAttribute('aria-modal', 'true');
        editReviewModal.setAttribute('aria-labelledby', 'edit-review-modal-title');
    }


    const checkAuthAndLoad = () => {
        if (isAuthReady) {
            loadUserProfile(); // This now calls loadUserComments, loadUserVotes, loadUserRatings

            // Open Edit Profile Modal
            if (editProfileButton) {
                editProfileButton.addEventListener('click', () => {
                    if (editProfileModal) {
                        editProfileModal.style.display = 'flex';
                        editUsernameInput.focus(); // Focus on first input
                    }
                });
            }

            // Close Edit Profile Modal
            if (closeEditProfileModalBtn) {
                closeEditProfileModalBtn.addEventListener('click', () => {
                    editProfileModal.style.display = 'none';
                    editUsernameStatusMessage.textContent = ''; // Clear status message on close
                });
            }
            if (editProfileModal) {
                window.addEventListener('click', (event) => {
                    if (event.target === editProfileModal) {
                        editProfileModal.style.display = 'none';
                        editUsernameStatusMessage.textContent = ''; // Clear status message on close
                    }
                });
            }

            // Handle Edit Profile Form Submission
            if (editProfileForm) {
                editProfileForm.addEventListener('submit', handleUpdateProfile);
            }

            // Real-time username availability check in Edit Profile Modal
            if (editUsernameInput) {
                editUsernameInput.addEventListener('input', () => {
                    clearTimeout(usernameCheckTimeout); // Clear previous timeout
                    const username = editUsernameInput.value.trim();
                    if (username.length > 0) {
                        usernameCheckTimeout = setTimeout(() => {
                            checkEditUsernameAvailability(username);
                        }, 500); // Debounce for 500ms
                    } else {
                        editUsernameStatusMessage.textContent = ''; // Clear message if input is empty
                    }
                });
            }

            // Open Change Password Modal
            if (changePasswordButton) {
                changePasswordButton.addEventListener('click', () => {
                    if (changePasswordModal) {
                        changePasswordModal.style.display = 'flex';
                        // Clear password fields when opening
                        currentPasswordInput.value = '';
                        newPasswordInput.value = '';
                        confirmNewPasswordInput.value = '';
                        currentPasswordInput.focus(); // Focus on first password input
                    }
                });
            }

            // Close Change Password Modal
            if (closeChangePasswordModalBtn) {
                closeChangePasswordModalBtn.addEventListener('click', () => {
                    changePasswordModal.style.display = 'none';
                });
            }
            if (changePasswordModal) {
                window.addEventListener('click', (event) => {
                    if (event.target === changePasswordModal) {
                        changePasswordModal.style.display = 'none';
                    }
                });
            }

            // Handle Change Password Form Submission
            if (changePasswordForm) {
                changePasswordForm.addEventListener('submit', handleChangePassword);
            }

            // Close functionality for Comment Edit Modal
            if (editCommentModal) {
                editCommentModal.querySelector('.close-button')?.addEventListener('click', () => {
                    editCommentModal.style.display = 'none';
                });
                window.addEventListener('click', (event) => {
                    if (event.target === editCommentModal) {
                        editCommentModal.style.display = 'none';
                    }
                });
            }

            // Event listener for comment edit form submission
            if (editCommentForm) editCommentForm.addEventListener('submit', handleEditCommentSubmit);

            // Close functionality for Review Edit Modal (my-reviews-list section)
            if (editReviewModal) {
                editReviewModal.querySelector('.close-button')?.addEventListener('click', () => {
                    editReviewModal.style.display = 'none';
                });
                window.addEventListener('click', (event) => {
                    if (event.target === editReviewModal) {
                        editReviewModal.style.display = 'none';
                    }
                });
            }

            // Event listener for review edit form submission (from profile)
            if (editReviewForm) {
                editReviewForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const updatedText = editReviewText.value.trim();
                    if (!updatedText) {
                        showToast('Review text cannot be empty.', 'warning');
                        return;
                    }

                    try {
                        console.log("Attempting to update review from profile:");
                        console.log("  Review ID:", currentEditReviewId);
                        console.log("  Current User ID:", currentUserId);
                        console.log("  Public Review Path:", `artifacts/${appId}/reviews/${currentEditReviewId}`);
                        console.log("  Private User Review Path:", `artifacts/${appId}/users/${currentUserId}/userReviews/${currentEditReviewId}`);


                        // Update in both global and user-specific collections
                        await updateDoc(doc(db, `artifacts/${appId}/reviews`, currentEditReviewId), {
                            reviewText: updatedText,
                            createdAt: Timestamp.now(),
                            userId: currentUserId // Ensure this is set for security rule matching
                        });

                        await updateDoc(doc(db, `artifacts/${appId}/users/${currentUserId}/userReviews`, currentEditReviewId), {
                            reviewText: updatedText,
                            createdAt: Timestamp.now()
                        });

                        showToast('Review updated successfully!', 'success');
                        editReviewModal.style.display = 'none';
                        loadUserRatings(); // reload after update
                        loadInterestedMovies();
                    } catch (err) {
                        console.error("Failed to update review:", err);
                        showToast('Failed to update review.', 'error');
                    }
                });
            }

        } else {
            setTimeout(checkAuthAndLoad, 100);
        }
    };
    checkAuthAndLoad();
});


/**
 * Loads and displays the current user's text reviews.
 */
const loadUserRatings = async () => {
    if (!myReviewsList || !currentUserId) return;

    myReviewsList.innerHTML = spinnerHtml; // Show spinner

    try {
        const reviewsRef = collection(db, `artifacts/${appId}/users/${currentUserId}/userReviews`);
        const q = query(reviewsRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            myReviewsList.innerHTML = '<p>You haven\'t submitted any reviews yet.</p>';
            return;
        }

        myReviewsList.innerHTML = '';

        for (const docSnap of snapshot.docs) {
            const review = docSnap.data();
            const reviewId = docSnap.id;

            let movieTitle = 'Unknown Movie';
            try {
                const movieRef = doc(db, `artifacts/${appId}/movies`, review.movieId);
                const movieSnap = await getDoc(movieRef);
                if (movieSnap.exists()) {
                    movieTitle = movieSnap.data().title;
                }
            } catch (err) {
                console.warn("Failed to fetch movie title for review:", err);
            }

            const stars = '⭐'.repeat(review.rating || 0);
            const date = formatDateTime(review.createdAt);

            const reviewCard = document.createElement('div');
            reviewCard.classList.add('user-list-item', 'review-card', 'p-4', 'border', 'rounded', 'shadow-sm', 'mb-4');
            reviewCard.setAttribute('aria-label', `Your review for ${movieTitle}, rated ${review.rating || 0} stars`);
            reviewCard.innerHTML = `
                <p class="item-title text-lg font-semibold mb-1">Review for: "<span class="text-primary-600">${movieTitle}</span>"</p>
                <p class="item-meta text-sm text-gray-600 mb-1">Rated: ${stars}</p>
                <p class="item-meta text-sm text-gray-600 mb-2">Date: ${date}</p>
                <p class="item-content text-gray-800 mb-3">${review.reviewText || ''}</p>
                <div class="item-actions flex gap-2">
                    <button class="edit-review-btn btn secondary btn-small py-1 px-3 rounded"
                            data-review-id="${reviewId}"
                            data-movie-id="${review.movieId}"
                            data-review-text="${review.reviewText || ''}"
                            data-rating="${review.rating || 0}"
                            aria-label="Edit this review">Edit</button>
                    <button class="delete-review-btn btn danger btn-small py-1 px-3 rounded"
                            data-review-id="${reviewId}"
                            aria-label="Delete this review">Delete</button>
                </div>
            `;
            myReviewsList.appendChild(reviewCard);
        }

        // Add event listeners for edit/delete
        myReviewsList.querySelectorAll('.edit-review-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reviewId = btn.dataset.reviewId;
                const movieId = btn.dataset.movieId;
                const text = btn.dataset.reviewText;
                editUserReview(reviewId, movieId, text);
            });
        });

        myReviewsList.querySelectorAll('.delete-review-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reviewId = btn.dataset.reviewId;
                confirmDeleteUserReview(reviewId);
            });
        });

    } catch (error) {
        console.error("Error loading user reviews:", error);
        showToast('Failed to load your reviews.', 'error');
        myReviewsList.innerHTML = '<p class="error-message">Error loading your reviews.</p>';
    }
};

// Called when Edit button is clicked (from user ratings list)
const editUserReview = (reviewId, movieId, text) => {
    currentEditReviewId = reviewId;
    currentEditMovieId = movieId;
    editReviewText.value = text || '';
    if (editReviewModal) {
        editReviewModal.style.display = 'flex';
        editReviewText.focus(); // Focus on the textarea when modal opens
    }
};

const confirmDeleteUserReview = (reviewId) => {
    showCustomModal('Are you sure you want to delete this review?', async () => {
        try {
            console.log("Attempting to delete review from profile (confirmDeleteUserReview):");
            console.log("  Review ID to delete:", reviewId);
            console.log("  Current User ID:", currentUserId);
            console.log("  Public Review Path:", `artifacts/${appId}/reviews/${reviewId}`);
            console.log("  Private User Review Path:", `artifacts/${appId}/users/${currentUserId}/userReviews/${reviewId}`);

            await deleteDoc(doc(db, `artifacts/${appId}/reviews`, reviewId));
            await deleteDoc(doc(db, `artifacts/${appId}/users/${currentUserId}/userReviews`, reviewId));
            showToast('Review deleted successfully!', 'success');
            loadUserRatings();
        } catch (error) {
            console.error("Failed to delete review:", error);
            showToast(`Error deleting review: ${error.message}`, 'error');
        }
    });
};

const interestedMoviesList = document.getElementById('interested-movies-list');

const loadInterestedMovies = async () => {
  if (!interestedMoviesList || !currentUserId) return;

  interestedMoviesList.innerHTML = spinnerHtml;

  try {
    const interestedRef = collection(db, `artifacts/${appId}/users/${currentUserId}/interests`);
    const snap = await getDocs(interestedRef);

    if (snap.empty) {
      interestedMoviesList.innerHTML = '<p>You haven\'t marked any movies as "Interested" yet.</p>';
      return;
    }

    interestedMoviesList.innerHTML = '';

    for (const docSnap of snap.docs) {
      const movieId = docSnap.id;
      const movieRef = doc(db, `artifacts/${appId}/movies`, movieId);
      const movieSnap = await getDoc(movieRef);

      if (!movieSnap.exists()) continue;

      const movie = movieSnap.data();
      const releaseDate = movie.releaseDate?.toDate?.() || new Date();
      const now = new Date();
      const countdownTime = Math.max(0, releaseDate.getTime() - now.getTime());
      

      const card = document.createElement('div');
card.className = 'movie-card';

card.innerHTML = `
  <img src="${movie.posterUrl || 'https://placehold.co/220x260/333/eee?text=No+Poster'}"
       alt="${movie.title}"
       loading="lazy">
  <div class="movie-info">
    <h3>${movie.title}</h3>
    <p>Release: ${formatDateTime(movie.releaseDate)}</p>
    <div id="countdown-${movieId}" class="countdown-timer"></div>
    <button class="remove-interest-btn" data-movie-id="${movieId}">Remove Interest</button>
  </div>
`;

// ✅ Redirect on card click (excluding the remove button)
card.addEventListener('click', (e) => {
  if (!e.target.classList.contains('remove-interest-btn')) {
    window.location.href = `movie-details.html?movieId=${movieId}`;
  }
});

interestedMoviesList.appendChild(card);
startCountdownTimer(`countdown-${movieId}`, releaseDate);


      interestedMoviesList.appendChild(card);

      startCountdownTimer(`countdown-${movieId}`, releaseDate);
    }

    interestedMoviesList.querySelectorAll('.remove-interest-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const movieId = btn.dataset.movieId;
        confirmRemoveInterest(movieId);
      });
    });

  } catch (err) {
    console.error("Error loading interested movies:", err);
    interestedMoviesList.innerHTML = '<p>Error loading your interested movies.</p>';
  }
};

const confirmRemoveInterest = (movieId) => {
  showCustomModal('Remove this movie from your Interested list?', async () => {
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/users/${currentUserId}/interests`, movieId));
      showToast('Removed from interested movies.', 'info');
      loadInterestedMovies();
    } catch (err) {
      console.error("Failed to remove interest:", err);
      showToast('Error removing interest.', 'error');
    }
  });
};

const savedBlogsList = document.getElementById('saved-blogs-list');

const loadSavedBlogs = async () => {
  if (!savedBlogsList || !currentUserId) return;

  savedBlogsList.innerHTML = '<p>Loading saved blogs...</p>';

  try {
    const savedRef = collection(db, `artifacts/${appId}/users/${currentUserId}/savedBlogs`);
    const savedSnap = await getDocs(savedRef);

    if (savedSnap.empty) {
      savedBlogsList.innerHTML = '<p>You haven\'t saved any blogs yet.</p>';
      return;
    }

    savedBlogsList.innerHTML = ''; // Clear spinner

    for (const docSnap of savedSnap.docs) {
      const blogId = docSnap.id;
      const blogRef = doc(db, `artifacts/${appId}/blogs`, blogId);
      const blogSnap = await getDoc(blogRef);

      if (!blogSnap.exists()) continue;

      const blog = blogSnap.data();
      const date = formatDateTime(blog.scheduledAt || blog.createdAt);

      // Create card
      const card = document.createElement('div');
      card.className = 'blog-card border rounded shadow p-4 flex flex-col';
      card.innerHTML = `
        <img src="${blog.imageUrl || 'https://placehold.co/220x140/333/eee?text=No+Image'}"
             alt="${blog.title}"
             class="w-full h-40 object-cover rounded mb-3"
             loading="lazy"
             onerror="this.onerror=null;this.src='https://placehold.co/220x140/333/eee?text=No+Image';">
        <h3 class="text-lg font-semibold mb-1">${blog.title}</h3>
        <p class="text-sm text-gray-600 mb-2">Published: ${date}</p>
        <p class="text-gray-800 mb-3">${blog.description?.substring(0, 120) || ''}...</p>
        <div class="flex gap-2">
          <button class="view-blog-btn btn secondary btn-small py-1 px-3 rounded" data-blog-id="${blogId}">
            View
          </button>
          <button class="remove-saved-blog-btn btn danger btn-small py-1 px-3 rounded" data-blog-id="${blogId}">
            Remove
          </button>
        </div>
      `;

      // View button
      card.querySelector('.view-blog-btn').addEventListener('click', () => {
        window.location.href = `blog-details.html?blogId=${blogId}`;
      });

      // Remove saved blog button
      card.querySelector('.remove-saved-blog-btn').addEventListener('click', () => {
        confirmRemoveSavedBlog(blogId);
      });

      savedBlogsList.appendChild(card);
    }

  } catch (err) {
    console.error("Failed to load saved blogs:", err);
    savedBlogsList.innerHTML = '<p>Error loading saved blogs. Please try again.</p>';
  }
};

const confirmRemoveSavedBlog = (blogId) => {
  showCustomModal('Remove this blog from your saved list?', async () => {
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/users/${currentUserId}/savedBlogs`, blogId));
      showToast('Blog removed from saved list.', 'info');
      loadSavedBlogs();
    } catch (err) {
      console.error("Failed to remove saved blog:", err);
      showToast('Error removing saved blog.', 'error');
    }
  });
};
