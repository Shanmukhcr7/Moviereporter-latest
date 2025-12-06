// js/movies.js

import { db, auth, currentUser, currentUserId, isAuthReady } from './firebase-init.js';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, orderBy, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, showCustomModal, formatDate } from './utils.js';
import { Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Get app ID from global variable
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// DOM Elements
const movieListContainer = document.getElementById('movie-list');
const genreFilter = document.getElementById('genre-filter');
const industryFilter = document.getElementById('industry-filter');
const movieDetailModal = document.getElementById('movie-detail-modal');
const reviewModal = document.getElementById('review-modal');
const reviewStarRating = document.getElementById('review-star-rating');
const reviewForm = document.getElementById('review-form');
const reviewTextInput = document.getElementById('review-text');
const movieSearchInput = document.getElementById('movie-search-input');
const movieSearchBtn = document.getElementById('movie-search-btn');
let allMoviesData = []; // ⬅️ GLOBAL so `handleSearch` can access it
let currentMovieId = null;
let selectedRating = 0;

/**
 * Loads and displays movies based on filters.
 * @param {string} genre Optional genre to filter by.
 * @param {string} industry Optional industry to filter by.
 */
const loadMovies = async (genre = '', industry = '') => {
    if (!movieListContainer) return;

    movieListContainer.innerHTML = '<p>Loading movies...</p>';

    try {
        const now = Timestamp.now();
        const moviesRef = collection(db, `artifacts/${appId}/movies`);

        // Build query conditions
        let conditions = [
            where('scheduledAt', '<=', now),
            where('releaseDate', '<=', now)
        ];

        if (genre) {
            conditions.push(where('genre', 'array-contains', genre));
        }
        if (industry) {
            conditions.push(where('industry', '==', industry));
        }

        const q = query(moviesRef, ...conditions, orderBy('releaseDate', 'desc'));

        const querySnapshot = await getDocs(q);
        movieListContainer.innerHTML = '';

        if (querySnapshot.empty) {
            movieListContainer.innerHTML = '<p class="no-data-message">No movies found matching your criteria.</p>';
            return;
        }

        allMoviesData.length = 0; // Clear previous data

        for (const docSnap of querySnapshot.docs) {
            const movie = docSnap.data();
            const movieId = docSnap.id;
            allMoviesData.push({ id: movieId, data: movie });

            const movieCard = `
                <div class="movie-card" data-movie-id="${movieId}">
                    <img src="${movie.posterUrl || 'https://placehold.co/200x300/333/eee?text=No+Poster'}" alt="${movie.title} Poster" onerror="this.onerror=null;this.src='https://placehold.co/200x300/333/eee?text=No+Poster';">
                    <div class="movie-card-info">
                        <h4>${movie.title}</h4>
                        <p>${movie.genre ? movie.genre.join(', ') : 'N/A'}</p>
                        <p>${movie.industry || 'N/A'}</p>
                        <p class="avg-rating-display">⭐ <span class="avg-stars" data-id="${movieId}">Loading...</span></p>
                    </div>
                </div>
            `;
            movieListContainer.insertAdjacentHTML('beforeend', movieCard);

            // Load and display average rating
            const avgRating = await calculateAverageRating(movieId);
            const span = document.querySelector(`.avg-stars[data-id="${movieId}"]`);
            if (span) {
                span.textContent = avgRating.toFixed(1);
            }
        }

        // Attach movie click event listeners
        movieListContainer.querySelectorAll('.movie-card').forEach(card => {
            card.addEventListener('click', (event) => {
                const movieId = event.currentTarget.dataset.movieId;
                showMovieDetail(movieId);
            });
        });

    } catch (error) {
        console.error("Error loading movies:", error);
        showToast('Failed to load movies. Please try again.', 'error');
        movieListContainer.innerHTML = '<p class="no-data-message">Error loading movies. Please try again.</p>';
    }
};
function handleSearch() {
    const searchTerm = movieSearchInput?.value.toLowerCase().trim();
    if (!searchTerm) {
        loadMovies('', industryFilter?.value); // ✅ genre removed
        return;
    }

    const filteredMovies = allMoviesData.filter(movie => {
        const data = movie.data;
        const titleMatch = data.title?.toLowerCase().includes(searchTerm);
        const genreMatch = data.genre?.some(g => g.toLowerCase().includes(searchTerm));
        const descriptionMatch = data.description?.toLowerCase().includes(searchTerm);
        const castMatch = data.cast?.some(c => {
            const name = typeof c === 'string' ? c : c.name;
            return name?.toLowerCase().includes(searchTerm);
        });

        return titleMatch || genreMatch || descriptionMatch || castMatch;
    });

    movieListContainer.innerHTML = '';

    if (filteredMovies.length === 0) {
        movieListContainer.innerHTML = `<p class="no-data-message">No movies found matching "${searchTerm}".</p>`;
        return;
    }

    filteredMovies.forEach(movie => {
        const movieCard = `
            <div class="movie-card" data-movie-id="${movie.id}">
                <img src="${movie.data.posterUrl || 'https://placehold.co/200x300/333/eee?text=No+Poster'}" alt="${movie.data.title}">
                <div class="movie-card-info">
                    <h4>${movie.data.title}</h4>
                    <p>${movie.data.genre?.join(', ') || 'N/A'}</p>
                    <p>${movie.data.industry || 'N/A'}</p>
                    <p class="avg-rating-display">⭐ <span class="avg-stars" data-id="${movie.id}">Loading...</span></p>
                </div>
            </div>
        `;
        movieListContainer.insertAdjacentHTML('beforeend', movieCard);
    });

    movieListContainer.querySelectorAll('.movie-card').forEach(card => {
        card.addEventListener('click', (event) => {
            const movieId = event.currentTarget.dataset.movieId;
            showMovieDetail(movieId);
        });
    });
}
let searchTimeout; // for debounce

movieSearchInput?.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    handleSearch(); // Auto-filter while typing
  }, 200); // delay in ms
});

/**
 * Displays the detailed view of a movie.
 * @param {string} movieId The ID of the movie to display.
 */
const showMovieDetail = async (movieId) => {
  currentMovieId = movieId;
  const movieDetailDisplay = document.getElementById('movie-detail-display');
  if (!movieDetailDisplay || !movieDetailModal) return;

  movieDetailDisplay.innerHTML = '<p class="loading-message">Loading movie details...</p>';
  movieDetailModal.style.display = 'flex';

  try {
    const movieDocRef = doc(db, `artifacts/${appId}/movies`, movieId);
    const movieDocSnap = await getDoc(movieDocRef);

    if (!movieDocSnap.exists()) {
      movieDetailDisplay.innerHTML = '<p class="no-data-message">Movie not found.</p>';
      showToast('Movie not found.', 'error');
      return;
    }

    const movie = movieDocSnap.data();
    const averageRating = await calculateAverageRating(movieId);
    const reviewCount = await getReviewCount(movieId);

    let reviewActionHTML = `<p>Please <a href="login.html" class="inline-link">login</a> to add a rating.</p>`;

    if (currentUser && currentUserId) {
      // Check if user already submitted a review
      const existingReviewQuery = query(
        collection(db, `artifacts/${appId}/reviews`),
        where('movieId', '==', movieId),
        where('userId', '==', currentUserId)
      );
      const existingReviewSnapshot = await getDocs(existingReviewQuery);

      if (existingReviewSnapshot.empty) {
        // User has not rated this movie
        reviewActionHTML = `<button id="add-review-btn" class="btn primary">Add Your Rating</button>`;
      } else {
        // User has already rated → Edit instead
        const userReview = existingReviewSnapshot.docs[0].data();
        const reviewId = existingReviewSnapshot.docs[0].id;
        reviewActionHTML = `<button id="edit-review-btn" class="btn primary">Edit Your Rating</button>`;

        // Attach click handler after render
        setTimeout(() => {
          document.getElementById('edit-review-btn')?.addEventListener('click', () => {
            editReview(reviewId, userReview.rating);
          });
        }, 100);
      }
    }

    movieDetailDisplay.innerHTML = `
      <div class="movie-detail-main">
        <img src="${movie.posterUrl || 'https://placehold.co/300x450/333/eee?text=No+Poster'}" alt="${movie.title} Poster" onerror="this.onerror=null;this.src='https://placehold.co/300x450/333/eee?text=No+Poster';">
        <div class="movie-info-text">
          <h3>${movie.title}</h3>
          <p><strong>Genre:</strong> ${movie.genre ? movie.genre.join(', ') : 'N/A'}</p>
          <p><strong>Industry:</strong> ${movie.industry || 'N/A'}</p>
          <p><strong>Release Date:</strong> ${movie.releaseDate ? formatDate(movie.releaseDate) : 'N/A'}</p>
          <p><strong>Average Rating:</strong> ${averageRating.toFixed(1)} ⭐ (${reviewCount} ratings)</p>
          <div class="movie-actions">
            ${reviewActionHTML}
          </div>
          <p class="description">${movie.description || 'No description available.'}</p>
          
        </div>
      </div>
    `;

    // Attach add-review button (only if not rated before)
    document.getElementById('add-review-btn')?.addEventListener('click', () => {
      resetReviewForm();
      reviewModal.style.display = 'flex';
    });

    await loadReviewsForMovie(movieId);

  } catch (error) {
    console.error("Error showing movie detail:", error);
    showToast('Failed to load movie details.', 'error');
    movieDetailDisplay.innerHTML = '<p class="no-data-message">Error loading details. Please try again.</p>';
  }
};


/**
 * Calculates the average star rating for a given movie.
 * @param {string} movieId The ID of the movie.
 * @returns {Promise<number>} The average rating.
 */
const calculateAverageRating = async (movieId) => {
    const reviewsRef = collection(db, `artifacts/${appId}/reviews`);
    // NOTE: If you previously filtered by approved: true here, it means unapproved reviews
    // were not counted. With auto-approve, this query implicitly counts all.
    const q = query(reviewsRef, where('movieId', '==', movieId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        return 0;
    }

    let totalRating = 0;
    querySnapshot.forEach(docSnap => {
        totalRating += docSnap.data().rating || 0;
    });

    return totalRating / querySnapshot.size;
};

/**
 * Gets the count of reviews for a given movie.
 * @param {string} movieId The ID of the movie.
 * @returns {Promise<number>} The number of reviews.
 */
const getReviewCount = async (movieId) => {
    const reviewsRef = collection(db, `artifacts/${appId}/reviews`);
    // NOTE: Same as above, if filtered by approved: true, adjust here if needed
    const q = query(reviewsRef, where('movieId', '==', movieId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
};


// REMOVED loadReviewsForMovie function entirely as it's no longer needed for display

/**
 * Handles the submission of a new or edited review (now rating).
 * @param {Event} event The form submission event.
 */
const handleReviewSubmit = async (event) => {
    event.preventDefault();

    if (!currentUser || !currentUserId) {
        showToast('You must be logged in to submit a rating.', 'error');
        return;
    }

    if (selectedRating === 0) {
        showToast('Please select a star rating.', 'warning');
        return;
    }

    try {
        const reviewData = {
    movieId: currentMovieId,
    userId: currentUserId,
    rating: selectedRating,
    reviewText: reviewTextInput?.value.trim() || "",
    createdAt: Timestamp.now(),
    approved: true
};


        const existingReviewQuery = query(
            collection(db, `artifacts/${appId}/reviews`),
            where('movieId', '==', currentMovieId),
            where('userId', '==', currentUserId)
        );
        const existingReviewSnapshot = await getDocs(existingReviewQuery);

        if (existingReviewSnapshot.empty) {
            // Add new rating
            const docRef = await addDoc(collection(db, `artifacts/${appId}/reviews`), reviewData);
            // Also store a reference in user's private data
            await setDoc(doc(db, `artifacts/${appId}/users/${currentUserId}/userReviews`, docRef.id), {
                movieId: currentMovieId,
                userId: currentUserId,
                reviewId: docRef.id,
                rating: selectedRating,
                reviewText: reviewTextInput?.value.trim() || "",
                createdAt: Timestamp.now(),
                approved: true // FIX: Automatically approved
            });
            showToast('Rating submitted successfully!', 'success'); // Updated message
        } else {
            // Update existing rating
            const reviewIdToUpdate = existingReviewSnapshot.docs[0].id;
            const reviewDocRef = doc(db, `artifacts/${appId}/reviews`, reviewIdToUpdate);
            await updateDoc(reviewDocRef, {
                rating: selectedRating,
                createdAt: Timestamp.now(), // Update timestamp on edit
                userId: currentUserId,
                approved: true // FIX: Automatically approved (no re-moderation)
            });
            // Update user's private reference
            await updateDoc(doc(db, `artifacts/${appId}/users/${currentUserId}/userReviews`, reviewIdToUpdate), {
                rating: selectedRating,
                createdAt: Timestamp.now(),
                approved: true // FIX: Automatically approved
            });
            showToast('Rating updated successfully!', 'success'); // Updated message
        }

        reviewModal.style.display = 'none';
        showMovieDetail(currentMovieId); // Re-show movie detail to update average rating and review count
    } catch (error) {
        console.error("Error submitting rating:", error);
        showToast(`Failed to submit rating: ${error.message}`, 'error');
    }
};

/**
 * Populates the review form for editing an existing rating.
 * @param {string} reviewId The ID of the review to edit.
 * @param {number} rating The existing rating.
 */
const editReview = (reviewId, rating) => {
    // No review text to set now
    setStarRating(rating); // Set the stars in the form
    reviewModal.style.display = 'flex';
};

/**
 * Confirms and deletes a user's review (rating).
 * @param {string} reviewId The ID of the review to delete.
 */
const confirmDeleteReview = (reviewId) => {
    showCustomModal('Are you sure you want to delete this rating? This action cannot be undone.', async () => {
        try {
            // Delete from public collection
            await deleteDoc(doc(db, `artifacts/${appId}/reviews`, reviewId));
            // Delete from user's private collection
            await deleteDoc(doc(db, `artifacts/${appId}/users/${currentUserId}/userReviews`, reviewId));
            showToast('Rating deleted successfully!', 'success');
            showMovieDetail(currentMovieId); // Re-show movie detail to update average rating and review count
        } catch (error) {
            console.error("Error deleting rating:", error);
            showToast(`Failed to delete rating: ${error.message}`, 'error');
        }
    });
};

/**
 * Sets the star rating visually and stores the selected value.
 * @param {number} rating The rating (1-5) to set.
 */
const setStarRating = (rating) => {
    selectedRating = rating;
    if (reviewStarRating) {
        Array.from(reviewStarRating.children).forEach(star => {
            const starValue = parseInt(star.dataset.value);
            if (starValue <= rating) {
                star.classList.remove('far'); // empty star
                star.classList.add('fas');    // filled star
            } else {
                star.classList.remove('fas');
                star.classList.add('far');
            }
        });
    }
};

/**
 * Resets the review form to its initial state.
 */
const resetReviewForm = () => {
    setStarRating(0);
    if (reviewTextInput) reviewTextInput.value = "";
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  const reviewTextInput = document.getElementById("review-text");

  movieSearchBtn?.addEventListener('click', handleSearch);
  movieSearchInput?.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  });

  const checkAuthAndLoad = () => {
    if (isAuthReady) {
      loadMovies('', industryFilter?.value); // genre removed

      // ✅ Only bind industry filter now
      if (industryFilter) {
        industryFilter.addEventListener('change', () => {
          loadMovies('', industryFilter.value); // pass only industry
        });
      }

      // Close movie detail modal
      movieDetailModal?.querySelector('.close-button')?.addEventListener('click', () => {
        movieDetailModal.style.display = 'none';
        currentMovieId = null;
      });

      window.addEventListener('click', (event) => {
        if (event.target === movieDetailModal) {
          movieDetailModal.style.display = 'none';
          currentMovieId = null;
        }
        if (event.target === reviewModal) {
          reviewModal.style.display = 'none';
          loadReviewsForMovie(currentMovieId);
        }
      });

      reviewModal?.querySelector('.close-button')?.addEventListener('click', () => {
        reviewModal.style.display = 'none';
      });

      reviewStarRating?.addEventListener('click', (event) => {
        if (event.target.classList.contains('fa-star')) {
          setStarRating(parseInt(event.target.dataset.value));
        }
      });

      reviewForm?.addEventListener('submit', handleReviewSubmit);
    } else {
      setTimeout(checkAuthAndLoad, 100);
    }
  };

  checkAuthAndLoad();
});

/**
 * Loads and displays reviews for a specific movie in the modal.
 * @param {string} movieId 
 */
const loadReviewsForMovie = async (movieId) => {
  const container = document.getElementById("movie-reviews-container");
  if (!container) return;
  container.innerHTML = "<p>Loading reviews...</p>";

  try {
    const reviewsRef = collection(db, `artifacts/${appId}/reviews`);
    const q = query(reviewsRef, where("movieId", "==", movieId), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      container.innerHTML = "<p>No reviews yet. Be the first to rate!</p>";
      return;
    }

    container.innerHTML = ""; // Clear previous reviews

    let userReview = null;
    const otherReviews = [];

    for (const docSnap of querySnapshot.docs) {
      const d = docSnap.data();
      const reviewId = docSnap.id;
      const isCurrentUser = currentUserId && d.userId === currentUserId;

      const ratingStars = '⭐'.repeat(d.rating);
      const dateStr = d.createdAt?.toDate?.().toLocaleString() || 'Unknown Date';

      let reviewer = "Anonymous";
      try {
        const userRef = doc(db, `artifacts/${appId}/users`, d.userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          reviewer = userSnap.data().username || d.userId;
        }
      } catch (err) {
        console.warn("Failed to fetch username:", err);
      }

      const reviewBlock = document.createElement("div");
      reviewBlock.classList.add("review-item");
      reviewBlock.innerHTML = `
        <p><strong>${reviewer}</strong> • ${ratingStars}</p>
        <p>${d.reviewText || ''}</p>
        <small>${dateStr}</small>
        ${isCurrentUser ? `
          <div class="review-actions">
            <button class="btn small edit-btn" data-review-id="${reviewId}" data-rating="${d.rating}">Edit</button>
            <button class="btn small danger delete-btn" data-review-id="${reviewId}">Delete</button>
          </div>
        ` : ''}
      `;

      if (isCurrentUser) {
        userReview = reviewBlock;
      } else {
        otherReviews.push(reviewBlock);
      }
    }

    // Show user's review on top
    if (userReview) {
      container.appendChild(userReview);
    }

    // Then show other reviews
    otherReviews.forEach(block => container.appendChild(block));

    // Add event listeners for edit/delete
    container.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const reviewId = e.target.dataset.reviewId;
        const rating = parseInt(e.target.dataset.rating);
        editReview(reviewId, rating); // Open modal for edit
      });
    });

    container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const reviewId = e.target.dataset.reviewId;
        confirmDeleteReview(reviewId); // Already exists in your code
      });
    });

  } catch (err) {
    console.error("Error loading reviews:", err);
    container.innerHTML = "<p>Failed to load reviews.</p>";
  }
};

const confirmDeleteUserReview = (reviewId) => {
  showCustomModal('Are you sure you want to delete this review?', async () => {
    try {
      // Delete from global reviews
      await deleteDoc(doc(db, `artifacts/${appId}/reviews`, reviewId));

      // Delete from user private collection
      await deleteDoc(doc(db, `artifacts/${appId}/users/${currentUserId}/userReviews`, reviewId));

      showToast('Review deleted successfully!', 'success');
      loadUserRatings(); // Refresh list
    } catch (error) {
      console.error("Error deleting review:", error);
      showToast(`Failed to delete review: ${error.message}`, 'error');
    }
  });
};
