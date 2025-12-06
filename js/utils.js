// js/utils.js

// Firebase imports specific to this utility file
// Note: userRole is imported here for the isAdmin function
import { userRole } from './firebase-init.js'; // Moved to top-level for correct import

/**
 * Displays a toast notification.
 * @param {string} message The message to display.
 * @param {'success'|'error'|'info'|'warning'} type The type of toast.
 * @param {number} duration The duration in milliseconds (default: 3000).
 */
export const showToast = (message, type = 'info', duration = 3000) => {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        // Log a warning if the container is not found, but do not create it dynamically here.
        // It's best practice for the toast-container div to be present in your dashboard.html.
        console.warn('Toast container (#toast-container) not found in DOM. Please ensure it exists in your HTML.');
        return; // Exit if container isn't there
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <button class="close-toast-button">&times;</button>
    `;
    toastContainer.appendChild(toast);

    // Force reflow to enable CSS transition for 'show' class
    void toast.offsetWidth;
    toast.classList.add('show');

    // Auto-hide after duration
    const timeoutId = setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide'); // Add 'hide' class to trigger CSS transition for fading out
        toast.addEventListener('transitionend', () => toast.remove(), { once: true }); // Remove after transition
    }, duration);

    // Close button functionality
    toast.querySelector('.close-toast-button')?.addEventListener('click', () => {
        clearTimeout(timeoutId); // Stop auto-hide
        toast.classList.remove('show');
        toast.classList.add('hide');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    });
};

// Global references for the custom modal elements
let customModal = null;
let customModalMessage = null;
let customModalConfirmBtn = null;
let customModalCancelBtn = null;
let customModalCloseBtn = null;
let currentOnConfirmCallback = null; // Store the user's onConfirm callback
let currentOnCancelCallback = null; // Store the user's onCancel callback

/**
 * Initializes the custom modal elements and attaches common event listeners.
 * This should be called once, ideally on DOMContentLoaded.
 */
const initializeCustomModal = () => {
    if (customModal) return; // Already initialized

    customModal = document.getElementById('custom-modal');
    if (customModal) {
        customModalMessage = document.getElementById('custom-modal-message');
        customModalConfirmBtn = document.getElementById('custom-modal-confirm-btn');
        customModalCancelBtn = document.getElementById('custom-modal-cancel-btn');
        customModalCloseBtn = customModal.querySelector('.close-button'); // Get the close button within the modal

        const handleConfirm = () => {
            customModal.style.display = 'none'; // Hide the modal
            if (currentOnConfirmCallback) {
                currentOnConfirmCallback(); // Execute the user's confirm callback
            }
            cleanupModalListeners();
        };

        const handleCancel = () => {
            customModal.style.display = 'none'; // Hide the modal
            if (currentOnCancelCallback) {
                currentOnCancelCallback(); // Execute the user's cancel callback
            }
            cleanupModalListeners();
        };

        const handleCloseButton = () => {
            // Treat closing via 'x' button as cancellation
            handleCancel();
        };

        const handleOutsideClick = (event) => {
            if (event.target === customModal) {
                // Treat outside click as cancellation
                handleCancel();
            }
        };

        // Attach permanent listeners for modal interactions
        customModalConfirmBtn?.addEventListener('click', handleConfirm);
        customModalCancelBtn?.addEventListener('click', handleCancel);
        customModalCloseBtn?.addEventListener('click', handleCloseButton);
        customModal?.addEventListener('click', handleOutsideClick); // Listen for clicks on the overlay
    } else {
        console.warn("Custom modal element (#custom-modal) not found on DOM load. showCustomModal might not work.");
    }
};

// Helper to remove event listeners (important for preventing memory leaks)
const cleanupModalListeners = () => {
    // No need to remove/re-add listeners here because the initializeCustomModal adds them once
    // and the callbacks are managed by currentOnConfirmCallback/currentOnCancelCallback.
    // We just clear the specific action callbacks.
    currentOnConfirmCallback = null;
    currentOnCancelCallback = null;
};

/**
 * Displays a custom confirmation modal.
 * @param {string} message The message to display in the modal.
 * @param {function} onConfirm Callback function when 'Confirm' is clicked.
 * @param {function} [onCancel=null] Callback function when 'Cancel' is clicked or modal is closed (optional).
 */
export const showCustomModal = (message, onConfirm, onCancel = null) => {
    // Ensure modal elements are initialized before trying to use them
    if (!customModal) {
        initializeCustomModal(); // Attempt to initialize if not already
        if (!customModal) {
            console.error("Custom modal elements are not available after initialization. Cannot show modal.");
            showToast("Error: Confirmation modal not available.", "error");
            return;
        }
    }

    customModalMessage.textContent = message;
    currentOnConfirmCallback = onConfirm;
    currentOnCancelCallback = onCancel;

    // Force positioning and centering via JS inline styles (ensures it's always on top)
    customModal.style.cssText = `
        display: flex !important; /* Force flex display */
        position: fixed !important; /* Force fixed positioning */
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important; /* Use viewport width */
        height: 100vh !important; /* Use viewport height */
        z-index: 9999 !important; /* Very high z-index */
        align-items: center !important; /* Center vertically */
        justify-content: center !important; /* Center horizontally */
        background-color: rgba(0, 0, 0, 0.7) !important; /* Overlay background */
    `;
};


/**
 * Formats a Firebase Timestamp or Date object into a readable date string.
 * @param {firebase.firestore.Timestamp|Date} input The timestamp or Date object.
 * @returns {string} The formatted date string (e.g., "Jan 01, 2023").
 */
export const formatDate = (input) => {
    if (!input) return 'N/A';
    let date;
    if (input instanceof Date) {
        date = input;
    } else if (input && typeof input.toDate === 'function') {
        date = input.toDate();
    } else {
        console.warn("Invalid date input for formatDate:", input);
        return 'Invalid Date';
    }
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

/**
 * Formats a Firebase Timestamp or Date object into a readable date and time string.
 * @param {firebase.firestore.Timestamp|Date} input The timestamp or Date object.
 * @returns {string} The formatted date and time string (e.g., "Jan 01, 2023, 10:30 AM").
 */
export const formatDateTime = (input) => {
    if (!input) return 'N/A';
    let date;
    if (input instanceof Date) {
        date = input;
    } else if (input && typeof input.toDate === 'function') {
        date = input.toDate();
    } else {
        console.warn("Invalid date input for formatDateTime:", input);
        return 'Invalid DateTime';
    }
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

/**
 * Checks if the current user has an 'admin' role.
 * This function relies on 'userRole' being populated by firebase-init.js.
 * @returns {boolean} True if user is admin, false otherwise.
 */
export const isAdmin = () => {
    // userRole is imported at the top of this module
    return userRole === 'admin';
};


/**
 * Escapes a string for safe inclusion within a JavaScript string literal
 * that is itself inside an HTML attribute (e.g., onclick="myFunc('escaped string')").
 * Handles backticks, single quotes, double quotes, and backslashes.
 * @param {string} str The string to escape.
 * @returns {string} The escaped string.
 */
export const escapeHtmlAttributeString = (str) => {
    if (typeof str !== 'string') {
        str = String(str); // Ensure it's treated as a string
    }
    // Escape backslashes first, then backticks, single quotes, and double quotes.
    // Order matters: escape backslash itself before other characters.
    return str.replace(/\\/g, '\\\\')
              .replace(/`/g, '\\`') // Escape backticks
              .replace(/'/g, "\\'") // Escape single quotes
              .replace(/"/g, '\\"'); // Escape double quotes
};


// Initialize the custom modal once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeCustomModal);

export function setupLatestMovieCarousel(container) {
  const prevBtn = document.getElementById('movies-carousel-prev');
  const nextBtn = document.getElementById('movies-carousel-next');

  const scrollAmount = 300;

  prevBtn?.addEventListener('click', () => {
    container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  });

  nextBtn?.addEventListener('click', () => {
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  });
}

export function setupUpcomingCarousel(container) {
  const prevBtn = document.getElementById('upcoming-carousel-prev');
  const nextBtn = document.getElementById('upcoming-carousel-next');

  prevBtn?.addEventListener('click', () => {
    container.scrollBy({ left: -300, behavior: 'smooth' });
  });

  nextBtn?.addEventListener('click', () => {
    container.scrollBy({ left: 300, behavior: 'smooth' });
  });
}

export function setupCelebrityCarousel(container) {
  const prevBtn = document.getElementById('celebrity-carousel-prev');
  const nextBtn = document.getElementById('celebrity-carousel-next');

  prevBtn?.addEventListener('click', () => {
    container.scrollBy({ left: -300, behavior: 'smooth' });
  });

  nextBtn?.addEventListener('click', () => {
    container.scrollBy({ left: 300, behavior: 'smooth' });
  });
}
