// js/firebase-init.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithCustomToken, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { showToast } from './utils.js';

// Global variables for Firebase instances and user data
export let auth;
export let db;
export let storage;
export let currentUser = null;
export let currentUserId = null;
export let userRole = 'user'; // Default role
export let isAuthReady = false; // Flag to indicate if auth state is ready

// Get app ID from global variable, default if not defined
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Firebase configuration from the user's prompt (corrected API key)
// IMPORTANT: In a real deployment, ensure this API key is managed securely
// and not directly committed to public repositories. The __firebase_config
// mechanism is preferred for production environments.
const fallbackFirebaseConfig = {
   apiKey: "AIzaSyB1-OPN7md7pwM4q2YBCxM9hHVEvr3NUWg",
  authDomain: "movie-reporter.firebaseapp.com",
  projectId: "movie-reporter",
  storageBucket: "movie-reporter.firebasestorage.app",
  messagingSenderId: "531723763328",
  appId: "1:531723763328:web:75b34bb4e4c9411778f065",
  measurementId: "G-Z2JF0SXPG7"
};

// Use the environment's firebaseConfig if available and valid, otherwise use the fallback
const firebaseConfig = typeof __firebase_config !== 'undefined' && typeof __firebase_config === 'string' && Object.keys(JSON.parse(__firebase_config)).length > 0 && JSON.parse(__firebase_config).apiKey
    ? JSON.parse(__firebase_config)
    : fallbackFirebaseConfig;

/**
 * Initializes Firebase application and services.
 */
const initializeFirebase = async () => {
    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);

        window.auth = auth;

        // Firebase Authentication listener
        onAuthStateChanged(auth, async (user) => {
            currentUser = user;
            if (user) {
                currentUserId = user.uid;
                // Fetch user profile from the user's UID document directly
                const userProfileRef = doc(db, `artifacts/${appId}/users`, user.uid);
                const userProfileSnap = await getDoc(userProfileRef);

                if (userProfileSnap.exists()) {
                    const profileData = userProfileSnap.data();
                    userRole = profileData.role || 'user';
                } else {
                    // If no profile, assume default user role and create a basic profile on the user's UID document
                    userRole = 'user';
                    await setDoc(userProfileRef, {
                        email: user.email,
                        username: user.email ? user.email.split('@')[0] : `user-${user.uid.substring(0, 8)}`,
                        role: userRole,
                        status: 'active'
                    });
                }
            } else {
                currentUserId = null;
                userRole = 'user'; // Default to 'user' for unauthenticated state
            }
            updateAuthUI();
            isAuthReady = true; // Auth state has been determined
            // console.log("Firebase Auth State Changed: ", { currentUser, currentUserId, userRole, isAuthReady }); // REMOVED
        });

        // Sign in with custom token if available
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            // console.warn("No __initial_auth_token provided. User will be unauthenticated."); // REMOVED
        }

        // console.log("Firebase initialized and auth listener set up."); // REMOVED

    } catch (error) {
        console.error("Error initializing Firebase:", error);
        showToast(`Firebase initialization error: ${error.message}`, 'error');
    }
};

/**
 * Updates the UI elements related to authentication (login/logout buttons, profile link).
 */
const updateAuthUI = () => {
    const desktopLoginLink = document.getElementById('desktop-login-link'); // Corrected ID
    const desktopLogoutButton = document.getElementById('desktop-logout-button'); // Corrected ID
    const profileLink = document.querySelector('.profile-link');
    const adminDashboardLink = document.querySelector('.admin-dashboard-link');

    // Mobile UI elements
    const mobileUserGreeting = document.getElementById('mobile-user-greeting');
    const mobileLoginLink = document.getElementById('mobile-login-link');
    const mobileLogoutButton = document.getElementById('mobile-logout-button'); // Mobile specific logout button


    if (currentUser) {
        // Desktop UI
        if (desktopLoginLink) desktopLoginLink.style.display = 'none';
        if (desktopLogoutButton) desktopLogoutButton.style.display = 'inline-block';
        if (profileLink) profileLink.style.display = 'inline-block';
        if (adminDashboardLink) {
            adminDashboardLink.style.display = userRole === 'admin' ? 'inline-block' : 'none';
        }

        // Mobile UI
        if (mobileUserGreeting) {
            // Fetch username from Firestore once available (if not already in currentUser)
            if (currentUser && currentUserId) {
                const userProfileRef = doc(db, `artifacts/${appId}/users`, currentUserId);
                getDoc(userProfileRef).then(userProfileSnap => {
                    if (userProfileSnap.exists()) {
                        const username = userProfileSnap.data().username || currentUser.email.split('@')[0];
                        mobileUserGreeting.textContent = `Hey, ${username}`;
                        mobileUserGreeting.style.display = 'inline-block';
                    } else {
                        mobileUserGreeting.textContent = `Hey, User`; // Fallback
                        mobileUserGreeting.style.display = 'inline-block';
                    }
                }).catch(error => {
                    console.error("Error fetching username for mobile greeting:", error);
                    mobileUserGreeting.textContent = `Hey, User`;
                    mobileUserGreeting.style.display = 'inline-block';
                });
            }
        }
        if (mobileLoginLink) mobileLoginLink.style.display = 'none';
        if (mobileLogoutButton) mobileLogoutButton.style.display = 'block'; // Mobile logout button is a block element in menu
        
    } else {
        // Desktop UI
        if (desktopLoginLink) desktopLoginLink.style.display = 'inline-block';
        if (desktopLogoutButton) desktopLogoutButton.style.display = 'none';
        if (profileLink) profileLink.style.display = 'none';
        if (adminDashboardLink) adminDashboardLink.style.display = 'none';

        // Mobile UI
        if (mobileUserGreeting) mobileUserGreeting.style.display = 'none';
        if (mobileLoginLink) mobileLoginLink.style.display = 'inline-block';
        if (mobileLogoutButton) mobileLogoutButton.style.display = 'none';
    }
};

/**
 * Handles user logout.
 */
const handleLogout = async () => {
    try {
        await signOut(auth);
        showToast('Logged out successfully!', 'success');
        // Redirect to home page or login page after logout
        window.location.href = '/';
    } catch (error) {
        console.error("Error logging out:", error);
        showToast(`Logout failed: ${error.message}`, 'error');
    }
};

// Attach logout listener if the button exists
document.addEventListener('DOMContentLoaded', () => {
    // Desktop logout button
    const desktopLogoutButton = document.getElementById('desktop-logout-button');
    if (desktopLogoutButton) {
        desktopLogoutButton.addEventListener('click', handleLogout);
    }

    // Mobile logout button
    const mobileLogoutButton = document.getElementById('mobile-logout-button');
    if (mobileLogoutButton) {
        mobileLogoutButton.addEventListener('click', handleLogout);
    }
    
    updateAuthUI(); // Initial UI update on page load
});

// Initialize Firebase when the script loads
initializeFirebase();

// Export the updateAuthUI function so it can be called from other modules if needed (e.g., after login/logout)
export { updateAuthUI };
