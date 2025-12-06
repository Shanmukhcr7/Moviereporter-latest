import { db } from './firebase-init.js';
import { collection, query, where, getDocs, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, formatDate } from './utils.js';

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const moviesInfoList = document.getElementById('movies-info-list');
const movieInfoSearchInput = document.getElementById('movie-info-search-input');
const movieInfoSearchBtn = document.getElementById('movie-info-search-btn');
const industryFilter = document.getElementById('industry-filter');
const loadMoreBtn = document.getElementById('load-more-btn');

let allMoviesData = [];
let displayedMovies = [];
const BATCH_SIZE = 6;
let currentIndex = 0;

function createMovieCardHtml(movie, movieId) {
  const releaseDate = movie.releaseDate?.toDate ? formatDate(movie.releaseDate.toDate()) : 'N/A';
  const genre = Array.isArray(movie.genre) ? movie.genre.join(', ') : 'N/A';
  const tags = [];
  if (movie.isPopular) tags.push("Most Popular");
  if (movie.isTopBoxOffice) tags.push("Top Box Office");
  const ottAvailability = movie.ottPublished ? 'Yes' : 'No';

  return `
    <div class="movie-card movie-info-card" data-movie-id="${movieId}">
      <img src="${movie.posterUrl || 'https://placehold.co/200x280?text=No+Poster'}"
           alt="${movie.title}" onerror="this.onerror=null;this.src='https://placehold.co/200x280?text=No+Poster';">
      <div class="movie-card-content">
        <h3>${movie.title}</h3>
        <p><strong>Genre:</strong> ${genre}</p>
        <p><strong>Industry:</strong> ${movie.industry || 'N/A'}</p>
      </div>
    </div>
  `;
}

function renderMoviesBatch() {
  const batch = displayedMovies.slice(currentIndex, currentIndex + BATCH_SIZE);

  if (batch.length === 0 && currentIndex === 0) {
    moviesInfoList.innerHTML = '<p class="text-center text-gray-400">No movies found.</p>';
    loadMoreBtn.style.display = 'none';
    return;
  }

  batch.forEach(movie => {
    moviesInfoList.insertAdjacentHTML('beforeend', createMovieCardHtml(movie.data, movie.id));
  });

  bindCardClicks();

  currentIndex += BATCH_SIZE;

  loadMoreBtn.style.display = currentIndex < displayedMovies.length ? 'block' : 'none';
}

function bindCardClicks() {
  document.querySelectorAll('.movie-card').forEach(card => {
    card.addEventListener('click', () => {
      const movieId = card.dataset.movieId;
      if (movieId) {
        window.location.href = `movie-details.html?movieId=${movieId}`;
      }
    });
  });
}

async function loadMoviesInfo() {
  if (!moviesInfoList) return;

  moviesInfoList.innerHTML = '<p class="text-center text-gray-400">Loading movies...</p>';
  allMoviesData = [];
  currentIndex = 0;

  try {
    const now = Timestamp.now();
    const moviesRef = collection(db, `artifacts/${appId}/movies`);
    const q = query(
      moviesRef,
      where('scheduledAt', '<=', now),
      where('releaseDate', '<=', now),
      orderBy('releaseDate', 'desc')
    );

    const querySnapshot = await getDocs(q);

    querySnapshot.forEach(doc => {
      allMoviesData.push({ id: doc.id, data: doc.data() });
    });

    applyFiltersAndSearch(); // Initial render
  } catch (error) {
    console.error("Error loading movies info:", error);
    showToast('Failed to load movies. Please try again.', 'error');
    moviesInfoList.innerHTML = '<p class="text-center text-red-500">Error loading movies.</p>';
  }
}

function applyFiltersAndSearch() {
  const searchTerm = movieInfoSearchInput.value.toLowerCase().trim();
  const selectedIndustry = industryFilter?.value;

  displayedMovies = allMoviesData.filter(movie => {
    const data = movie.data;

    // Filter by industry
    if (selectedIndustry && selectedIndustry !== 'All' && data.industry !== selectedIndustry) {
      return false;
    }

    // Filter by search
    if (!searchTerm) return true;

    return (
      data.title?.toLowerCase().includes(searchTerm) ||
      (Array.isArray(data.genre) && data.genre.some(g => g.toLowerCase().includes(searchTerm))) ||
      data.description?.toLowerCase().includes(searchTerm) ||
      (Array.isArray(data.cast) && data.cast.some(c => {
        if (typeof c === 'string') return c.toLowerCase().includes(searchTerm);
        if (typeof c === 'object' && c.name) return c.name.toLowerCase().includes(searchTerm);
        return false;
      }))
    );
  });

  moviesInfoList.innerHTML = '';
  currentIndex = 0;
  renderMoviesBatch();
}

let debounceTimeout;
movieInfoSearchInput?.addEventListener('input', () => {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    applyFiltersAndSearch();
  }, 200);
});

industryFilter?.addEventListener('change', () => {
  applyFiltersAndSearch();
});

movieInfoSearchBtn?.addEventListener('click', () => {
  applyFiltersAndSearch();
});

loadMoreBtn?.addEventListener('click', () => {
  renderMoviesBatch();
});

document.addEventListener('DOMContentLoaded', loadMoviesInfo);
