import { db } from './firebase-init.js';
import { collection, getDocs, query, where, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, formatDate } from './utils.js';

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const topMoviesListContainer = document.getElementById('top-movies-list');
const topMoviesSearchInput = document.getElementById('top-movies-search-input');
const topMoviesSearchBtn = document.getElementById('top-movies-search-btn');

let allTopMoviesData = [];

function createMovieCardHtml(movie, movieId) {
    const releaseDate = movie.releaseDate ? formatDate(movie.releaseDate.toDate()) : 'N/A';
    const genre = movie.genre?.length ? movie.genre.join(', ') : 'N/A';
    const tags = [];
    if (movie.isPopular) tags.push('Most Popular');
    if (movie.isTopBoxOffice) tags.push('Top Box Office');
    const ottAvailability = movie.ottPublished ? 'Yes' : 'No';

    return `
        <div class="movie-card" data-movie-id="${movieId}">
            <img src="${movie.posterUrl || 'https://placehold.co/220x250/333/eee?text=No+Poster'}" alt="${movie.title}" 
                 onerror="this.onerror=null;this.src='https://placehold.co/220x250/333/eee?text=No+Poster';">
            <div class="movie-card-content">
                <h3>${movie.title}</h3>
                <p class="genre">${genre}</p>
                ${tags.length ? `<p class="text-sm text-gray-400">Tags: ${tags.join(', ')}</p>` : ''}
            </div>
        </div>
    `;
}

function renderMovies(moviesToDisplay) {
    topMoviesListContainer.innerHTML = '';

    if (moviesToDisplay.length === 0) {
        topMoviesListContainer.innerHTML = '<p class="text-center text-gray-400">No popular or top box office movies found.</p>';
        return;
    }

    moviesToDisplay.forEach(movie => {
        topMoviesListContainer.innerHTML += createMovieCardHtml(movie.data, movie.id);
    });

    // Redirect to details on click
    topMoviesListContainer.querySelectorAll('.movie-card').forEach(card => {
        card.addEventListener('click', () => {
            const movieId = card.dataset.movieId;
            if (movieId) {
                window.location.href = `movie-details.html?movieId=${movieId}`;
            }
        });
    });
}

async function loadTopMovies() {
    topMoviesListContainer.innerHTML = '<p class="text-center text-gray-400">Loading popular and top box office movies...</p>';
    allTopMoviesData = [];

    try {
        const now = Timestamp.now();
        const moviesRef = collection(db, `artifacts/${appId}/movies`);
        const q = query(moviesRef, where('scheduledAt', '<=', now), orderBy('releaseDate', 'desc'));
        const snapshot = await getDocs(q);

        snapshot.forEach(docSnap => {
            const movie = docSnap.data();
            if (movie.isPopular || movie.isTopBoxOffice) {
                allTopMoviesData.push({ id: docSnap.id, data: movie });
            }
        });

        renderMovies(allTopMoviesData);
    } catch (error) {
        console.error("Error loading movies:", error);
        topMoviesListContainer.innerHTML = '<p class="text-center text-red-500">Error loading movies.</p>';
        showToast('Failed to load top movies. Try again.', 'error');
    }
}

function handleSearch() {
    const searchTerm = topMoviesSearchInput.value.toLowerCase().trim();
    if (!searchTerm) {
        renderMovies(allTopMoviesData);
        return;
    }

    const filteredMovies = allTopMoviesData.filter(movie => {
        const data = movie.data;
        const titleMatch = data.title?.toLowerCase().includes(searchTerm);
        const genreMatch = data.genre?.some(g => g.toLowerCase().includes(searchTerm));
        const descMatch = data.description?.toLowerCase().includes(searchTerm);
        const castMatch = data.cast?.some(c => typeof c === 'object' && c.name?.toLowerCase().includes(searchTerm));
        return titleMatch || genreMatch || descMatch || castMatch;
    });

    renderMovies(filteredMovies);
    if (filteredMovies.length === 0) {
        topMoviesListContainer.innerHTML = `<p class="text-center text-gray-400">No movies found matching "${searchTerm}".</p>`;
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadTopMovies();
    topMoviesSearchBtn?.addEventListener('click', handleSearch);
    topMoviesSearchInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
});
