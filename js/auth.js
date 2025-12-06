// js/auth.js

import { auth, db, currentUser, currentUserId, isAuthReady } from './firebase-init.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc, getDoc, collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast } from './utils.js';
import { Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Get app ID from global variable
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// DOM Elements for Login
const loginForm = document.getElementById('login-form');
const loginIdentifierInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');

// DOM Elements for Register
const registerForm = document.getElementById('register-form');
const registerUsernameInput = document.getElementById('register-username');
const registerMobileInput = document.getElementById('register-mobile');
const registerEmailInput = document.getElementById('register-email');
const registerPasswordInput = document.getElementById('register-password');
const registerConfirmPasswordInput = document.getElementById('register-confirm-password');
const usernameStatusMessage = document.getElementById('username-status-message'); // NEW: Username status message DOM element

let usernameCheckTimeout; // For debouncing the username check

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
 * Updated: Requires a minimum of 10 digits.
 * @param {string} str The string to validate.
 * @returns {boolean} True if it's a valid mobile number, false otherwise.
 */
const isValidMobileNumber = (str) => {
    return /^\+?[0-9]{10}$/.test(str);
};

/**
 * Checks if a username is already taken in Firestore.
 * @param {string} username The username to check.
 * @returns {Promise<boolean>} True if available, false if taken.
 */
const checkUsernameAvailability = async (username) => {
    usernameStatusMessage.textContent = 'Checking availability...';
    usernameStatusMessage.style.color = 'var(--info-color)'; // Info color for checking status

    if (username.length < 6) { // Minimum username length
        usernameStatusMessage.textContent = 'Username must be at least 6 characters.';
        usernameStatusMessage.style.color = 'var(--warning-color)';
        return false;
    }
    
    try {
        const usersRef = collection(db, `artifacts/${appId}/users`);
        const q = query(usersRef, where('username', '==', username), limit(1)); // Limit to 1 for efficiency
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            usernameStatusMessage.textContent = 'Username is available!';
            usernameStatusMessage.style.color = 'var(--success-color)';
            return true;
        } else {
            usernameStatusMessage.textContent = 'Username is already taken.';
            usernameStatusMessage.style.color = 'var(--error-color)';
            return false;
        }
    } catch (error) {
        console.error("Error checking username availability:", error);
        usernameStatusMessage.textContent = 'Error checking username. Please try again.';
        usernameStatusMessage.style.color = 'var(--error-color)';
        return false;
    }
};


/**
 * Handles user registration.
 * @param {Event} event The form submission event.
 */
const handleRegister = async (event) => {
    event.preventDefault();

    const username = registerUsernameInput.value.trim();
    const mobileNumber = registerMobileInput.value.trim();
    const email = registerEmailInput.value.trim();
    const password = registerPasswordInput.value.trim();
    const confirmPassword = registerConfirmPasswordInput.value.trim();

    if (!username || !mobileNumber || !email || !password || !confirmPassword) {
        showToast('Please fill in all fields.', 'warning');
        return;
    }

    if (password !== confirmPassword) {
        showToast('Passwords do not match.', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Password should be at least 6 characters.', 'warning');
        return;
    }

    // Ensure email format is valid
    if (!isValidEmail(email)) {
        showToast('Please enter a valid email address.', 'error');
        return;
    }

    // Basic mobile number validation - NOW REQUIRES MIN 10 DIGITS
    if (!isValidMobileNumber(mobileNumber)) {
        showToast('Please enter a valid mobile number (10 digits, optional + prefix).', 'error');
        return;
    }

    // NEW: Final check for username availability before registration
    // This will prevent registration if the username is taken at the moment of submission
    const isUsernameAvailable = await checkUsernameAvailability(username);
    if (!isUsernameAvailable) {
        showToast('Please choose an available username.', 'error');
        return;
    }

    try {
        // Check if a user with this mobile number already exists in Firestore.
        const usersRef = collection(db, `artifacts/${appId}/users`);
        const qMobile = query(usersRef, where('mobileNumber', '==', mobileNumber));
        const mobileSnapshot = await getDocs(qMobile);
        if (!mobileSnapshot.empty) {
            showToast('A user with this mobile number already exists.', 'error');
            return;
        }

        // Proceed with Firebase email/password registration
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Store user profile in Firestore
        const userProfileRef = doc(db, `artifacts/${appId}/users`, user.uid);
        await setDoc(userProfileRef, {
            email: user.email,
            username: username, // Save the username
            mobileNumber: mobileNumber,
            role: 'user',
            status: 'active',
            createdAt: Timestamp.now()
        });

        showToast('Registration successful! Redirecting to login...', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);

    } catch (error) {
        console.error("Error during registration:", error);
        let errorMessage = 'Registration failed. Please try again.';
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'The email address is already in use by another account.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'The email address is not valid.';
                break;
            case 'auth/weak-password':
                errorMessage = 'The password is too weak.';
                break;
            default:
                errorMessage = `Registration failed: ${error.message}`;
                break;
        }
        showToast(errorMessage, 'error');
    }
};

/**
 * Handles user login. Allows login with email or mobile number.
 * @param {Event} event The form submission event.
 */
const handleLogin = async (event) => {
    event.preventDefault();

    const identifier = loginIdentifierInput.value.trim();
    const password = loginPasswordInput.value.trim();

    if (!identifier || !password) {
        showToast('Please enter your email/mobile and password.', 'warning');
        return;
    }

    let loginEmail = '';

    if (isValidEmail(identifier)) {
        loginEmail = identifier;
    } else if (isValidMobileNumber(identifier)) {
        try {
            const usersRef = collection(db, `artifacts/${appId}/users`);
            const q = query(usersRef, where('mobileNumber', '==', identifier), limit(1));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                showToast('No account found with that mobile number. Please check the number or register.', 'error');
                return;
            }

            const userData = querySnapshot.docs[0].data();
            loginEmail = userData.email;
            if (!loginEmail) {
                showToast('User profile found, but no email linked. Please contact support.', 'error');
                return;
            }

        } catch (error) {
            console.error("Error looking up user by mobile number:", error);
            showToast('Failed to find account by mobile number. Please try again.', 'error');
            return;
        }
    } else {
        showToast('Please enter a valid email or mobile number.', 'error');
        return;
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
        const user = userCredential.user;

        const userProfileRef = doc(db, `artifacts/${appId}/users`, user.uid);
        const userProfileSnap = await getDoc(userProfileRef);

        if (userProfileSnap.exists()) {
            const profileData = userProfileSnap.data();
            if (profileData.status === 'blocked') {
                await signOut(auth);
                showToast('Your account has been blocked. Please contact support.', 'error');
                return;
            }
        } else {
            showToast('User profile not found. Please contact support.', 'error');
            await signOut(auth);
            return;
        }

        showToast('Login successful! Redirecting...', 'success');
        setTimeout(() => {
            window.location.href = '/';
        }, 1500);

    } catch (error) {
        console.error("Error during login:", error);
        let errorMessage = 'Login failed. Please check your credentials.';
        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage = 'Invalid email or password.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'Your account has been disabled.';
                break;
            case 'auth/user-not-found':
                errorMessage = 'No user found with this email or mobile number.';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password.';
                break;
            case 'auth/invalid-credential':
                errorMessage = 'Invalid email/mobile number or password.';
                break;
            default:
                errorMessage = `Login failed: ${error.message}`;
                break;
        }
        showToast(errorMessage, 'error');
    }
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
        
        // NEW: Event listener for username input with debouncing
        registerUsernameInput.addEventListener('input', () => {
            clearTimeout(usernameCheckTimeout); // Clear previous timeout
            const username = registerUsernameInput.value.trim();
            if (username.length > 0) { // Only check if something is typed
                usernameCheckTimeout = setTimeout(() => {
                    checkUsernameAvailability(username);
                }, 500); // Debounce for 500ms
            } else {
                usernameStatusMessage.textContent = ''; // Clear message if input is empty
            }
        });
    }
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const checkAuthStatusAndRedirect = () => {
        if (isAuthReady) {
            if (currentUser && (window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html'))) {
                showToast('Already logged in! Redirecting to home.', 'info');
                window.location.href = '/';
            }
        } else {
            setTimeout(checkAuthStatusAndRedirect, 100);
        }
    };
    checkAuthStatusAndRedirect();
});


import { sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';

document.getElementById("forgot-password-link")?.addEventListener("click", async (e) => {
  e.preventDefault();

  const emailInput = document.getElementById("login-email");
  const email = emailInput?.value.trim();

  if (!email) {
    showToast("Please enter your email address.", "warning");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showToast("Password reset email sent successfully.", "success");
  } catch (err) {
    console.error("Password reset error:", err);
    showToast(err.message, "error");
  }
});
