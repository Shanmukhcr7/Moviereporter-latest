import { db } from './firebase-init.js';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  doc,
  setDoc,
  deleteDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { showToast, formatDate } from './utils.js';

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const listContainer = document.getElementById('upcoming-movies-list');
const searchInput = document.getElementById('upcoming-movies-search-input');
const searchBtn = document.getElementById('upcoming-movies-search-btn');
const loadMoreBtn = document.getElementById('load-more-upcoming-btn');
const industryFilter = document.getElementById('upcoming-industry-filter');

let allMoviesData = [];
let filteredMovies = [];
let currentDisplayCount = 0;
let userInterests = new Set();
const MOVIES_PER_BATCH = 8;

let currentUser = null;
const auth = getAuth();

// Fetch user's interest list
async function fetchUserInterests() {
  userInterests.clear();
  if (!currentUser) return;

  const ref = collection(db, `artifacts/${appId}/users/${currentUser.uid}/interests`);
  const snap = await getDocs(ref);
  snap.forEach(doc => userInterests.add(doc.id));
}

function createMovieCardHtml(movie, movieId) {
  const releaseDate = movie.releaseDate ? formatDate(movie.releaseDate.toDate()) : 'N/A';
  const genre = movie.genre?.length ? movie.genre.join(', ') : 'N/A';
  const isInterested = userInterests.has(movieId);
  const release = movie.releaseDate?.toDate();
  const now = new Date();
  const countdownNeeded = isInterested && release && release > now;

  return `
    <div class="movie-card" data-movie-id="${movieId}">
      <img src="${movie.posterUrl || 'https://placehold.co/220x250/333/eee?text=No+Poster'}"
           alt="${movie.title}"
           onerror="this.onerror=null;this.src='https://placehold.co/220x250/333/eee?text=No+Poster';">
      <div class="movie-card-content">
        <h3>${movie.title}</h3>
        
        <p class="text-sm text-gray-400">Release Date: ${releaseDate}</p>
        ${countdownNeeded ? `<p class="countdown" data-release="${release}"></p>` : ''}
        <button class="interest-btn" data-movie-id="${movieId}" data-state="${isInterested ? 'remove' : 'add'}">
          ${isInterested ? 'Remove Interest' : "I'm Interested"}
        </button>
      </div>
    </div>
  `;
}

function renderMoviesChunk(movies) {
  const chunk = movies.slice(currentDisplayCount, currentDisplayCount + MOVIES_PER_BATCH);
  chunk.forEach(movie => {
    listContainer.insertAdjacentHTML('beforeend', createMovieCardHtml(movie.data, movie.id));
  });

  document.querySelectorAll('.interest-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const movieId = btn.dataset.movieId;
      const movie = allMoviesData.find(m => m.id === movieId);
      if (!currentUser) {
        showToast('Please login to save your interest.', 'info');
        return;
      }

      const ref = doc(db, `artifacts/${appId}/users/${currentUser.uid}/interests/${movieId}`);
      if (btn.dataset.state === 'add') {
        await setDoc(ref, {
          movieId,
          title: movie.data.title,
          releaseDate: movie.data.releaseDate,
          posterUrl: movie.data.posterUrl || '',
          addedAt: Timestamp.now()
        });
        showToast('Added to your interests!', 'success');
      } else {
        await deleteDoc(ref);
        showToast('Removed from interests.', 'info');
      }

      await fetchUserInterests();
      refreshFilteredMovies();
    });
  });

  // Add click to open movie details
  document.querySelectorAll('.movie-card').forEach(card => {
    card.addEventListener('click', () => {
      const movieId = card.dataset.movieId;
      if (movieId) {
        window.location.href = `movie-details.html?movieId=${movieId}`;
      }
    });
  });

  currentDisplayCount += chunk.length;
  loadMoreBtn.style.display = currentDisplayCount < movies.length ? 'inline-block' : 'none';

  updateCountdowns(); // initial
}

// Update countdowns every minute
function updateCountdowns() {
  const countdowns = document.querySelectorAll('.countdown');
  const now = new Date();
  countdowns.forEach(el => {
    const releaseDate = new Date(el.dataset.release);
    const diff = releaseDate - now;
    if (diff <= 0) {
      el.textContent = 'Released!';
      return;
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    el.textContent = `Releases in ${days}d ${hours}h ${mins}m`;
  });
}
setInterval(updateCountdowns, 60000);

function filterMovies(searchTerm = '', industry = 'All') {
  const term = searchTerm.toLowerCase().trim();

  filteredMovies = allMoviesData.filter(({ data }) => {
    const matchesSearch = !term || (
      data.title?.toLowerCase().includes(term) ||
      data.description?.toLowerCase().includes(term) ||
      data.genre?.some(g => g.toLowerCase().includes(term)) ||
      data.cast?.some(c => typeof c === 'string'
        ? c.toLowerCase().includes(term)
        : c.name?.toLowerCase().includes(term))
    );

    const matchesIndustry = industry === 'All' || data.industry === industry;

    return matchesSearch && matchesIndustry;
  });

  listContainer.innerHTML = '';
  currentDisplayCount = 0;

  if (filteredMovies.length === 0) {
    listContainer.innerHTML = `<p class="text-center text-gray-400">No upcoming movies found.</p>`;
    loadMoreBtn.style.display = 'none';
    return;
  }

  renderMoviesChunk(filteredMovies);
}

async function loadUpcomingMovies() {
  listContainer.innerHTML = '<p class="text-center text-gray-400">Loading upcoming releases...</p>';
  allMoviesData = [];

  try {
    const now = Timestamp.now();
    const moviesRef = collection(db, `artifacts/${appId}/movies`);
    const q = query(
      moviesRef,
      where('scheduledAt', '<=', now),
      where('releaseDate', '>', now),
      orderBy('releaseDate', 'asc')
    );

    const snapshot = await getDocs(q);
    snapshot.forEach(doc => {
      allMoviesData.push({ id: doc.id, data: doc.data() });
    });

    await fetchUserInterests();
    filterMovies(); // initial load
  } catch (error) {
    console.error("Error loading upcoming movies:", error);
    showToast('Failed to load upcoming movies. Please try again.', 'error');
    listContainer.innerHTML = '<p class="text-center text-red-500">Error loading upcoming movies.</p>';
  }
}

function refreshFilteredMovies() {
  listContainer.innerHTML = '';
  currentDisplayCount = 0;
  renderMoviesChunk(filteredMovies);
}

// INIT
onAuthStateChanged(auth, async user => {
  currentUser = user;
  await loadUpcomingMovies();
});

searchInput?.addEventListener('input', () => {
  filterMovies(searchInput.value, industryFilter?.value || 'All');
});

searchBtn?.addEventListener('click', () => {
  filterMovies(searchInput.value, industryFilter?.value || 'All');
});

industryFilter?.addEventListener('change', () => {
  filterMovies(searchInput.value, industryFilter?.value || 'All');
});

loadMoreBtn?.addEventListener('click', () => {
  renderMoviesChunk(filteredMovies);
});
