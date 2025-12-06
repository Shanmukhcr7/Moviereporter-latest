import { db } from './firebase-init.js';
import { collection, query, where, getDocs, orderBy, Timestamp, startAfter, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, formatDate } from './utils.js';

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const ottMoviesListContainer = document.getElementById('ott-movies-list');
const ottMoviesSearchInput = document.getElementById('ott-movies-search-input');
const ottMoviesSearchBtn = document.getElementById('ott-movies-search-btn');
const ottPlatformFilter = document.getElementById('ott-platform-filter');
const loadMoreBtn = document.getElementById('load-more-ott-btn');

let allOttMoviesData = [];
let lastVisibleDoc = null;
const PAGE_LIMIT = 6;
let currentPlatformFilter = '';

const ottPlatformImages = {
    "amazon prime": "prime.webp",
    "netflix": "netflix.webp",
    "youtube": "youtube.webp",
    "jio hotstar": "hotstar.webp",
    "sony liv": "sonyliv.webp",
    "sun nxt": "sunnxt.webp",
    "zee tv": "zeetv.webp",
    "etv1": "etv.webp",
    "aha": "aha.webp",
    "jio cinema": "jiocinema.webp",
    "mx player": "mx-player.webp",
};

function createMovieCardHtml(movie, movieId) {
    const releaseDate = movie.releaseDate ? formatDate(movie.releaseDate.toDate()) : 'N/A';
    const genre = movie.genre?.length > 0 ? movie.genre.join(', ') : 'N/A';

    let ottPlatformsHtml = '';
    if (movie.ottPublished && movie.ottPlatforms?.length) {
        const maxIconsToShow = 2;
        const displayed = movie.ottPlatforms.slice(0, maxIconsToShow);
        const remaining = movie.ottPlatforms.length - maxIconsToShow;

        ottPlatformsHtml = '<div class="ott-platforms-display flex items-center gap-1 mt-2">';
        ottPlatformsHtml += '<div class="ott-separator-line"></div>';
        displayed.forEach(p => {
            const key = p.toLowerCase();
            if (ottPlatformImages[key]) {
                ottPlatformsHtml += `<img src="../images/${ottPlatformImages[key]}" alt="${p}" class="ott-icon" title="${p}">`;
            }
        });
        if (remaining > 0) {
            ottPlatformsHtml += `<span class="ott-more-text">+${remaining} more</span>`;
        }
        ottPlatformsHtml += '</div>';
    }

    return `
        <div class="movie-card" data-movie-id="${movieId}">
            <img src="${movie.posterUrl || 'https://placehold.co/220x250/333/eee?text=No+Poster'}" alt="${movie.title}">
            <div class="movie-card-content">
                <h3>${movie.title}</h3>
                <p class="genre">${genre}</p>
                <p class="text-sm text-gray-400">Release: ${releaseDate}</p>
                ${ottPlatformsHtml}
            </div>
        </div>
    `;
}

function renderMovies(moviesToDisplay, append = false) {
    if (!ottMoviesListContainer) return;

    if (!append) ottMoviesListContainer.innerHTML = '';

    if (moviesToDisplay.length === 0 && !append) {
        ottMoviesListContainer.innerHTML = '<p class="text-center text-gray-400">No OTT Released found.</p>';
        loadMoreBtn.style.display = 'none';
        return;
    }

    moviesToDisplay.forEach(movie => {
        ottMoviesListContainer.innerHTML += createMovieCardHtml(movie.data, movie.id);
    });

    ottMoviesListContainer.querySelectorAll('.movie-card').forEach(card => {
        card.addEventListener('click', e => {
            const movieId = e.currentTarget.dataset.movieId;
            if (movieId) window.location.href = `movie-details.html?movieId=${movieId}`;
        });
    });

    loadMoreBtn.style.display = moviesToDisplay.length < PAGE_LIMIT ? 'none' : 'inline-block';
}

async function loadOttMovies(initial = true) {
    if (!ottMoviesListContainer) return;

    if (initial) {
        ottMoviesListContainer.innerHTML = '<p class="text-center text-gray-400">Loading OTT Released...</p>';
        allOttMoviesData = [];
        lastVisibleDoc = null;
    }

    try {
        const now = Timestamp.now();
        let q = query(
            collection(db, `artifacts/${appId}/movies`),
            where('ottPublished', '==', true),
            where('scheduledAt', '<=', now),
            orderBy('scheduledAt', 'desc'),
            limit(PAGE_LIMIT)
        );

        if (lastVisibleDoc) q = query(q, startAfter(lastVisibleDoc));

        const snapshot = await getDocs(q);
        if (snapshot.empty && initial) {
            ottMoviesListContainer.innerHTML = '<p class="text-center text-gray-400">No OTT Released found.</p>';
            return;
        }

        const newData = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!currentPlatformFilter || (data.ottPlatforms || []).includes(currentPlatformFilter)) {
                newData.push({ id: doc.id, data });
            }
        });

        allOttMoviesData = initial ? newData : [...allOttMoviesData, ...newData];
        renderMovies(newData, !initial);

        lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
    } catch (error) {
        console.error("Error loading OTT movies:", error);
        showToast('Failed to load OTT Released.', 'error');
    }
}

function handleSearch() {
    const term = ottMoviesSearchInput.value.trim().toLowerCase();
    if (!term) return renderMovies(allOttMoviesData);

    const filtered = allOttMoviesData.filter(({ data }) =>
        data.title?.toLowerCase().includes(term) ||
        data.genre?.some(g => g.toLowerCase().includes(term)) ||
        data.description?.toLowerCase().includes(term) ||
        data.cast?.some(c => typeof c === 'string' ? c.toLowerCase().includes(term) : c.name?.toLowerCase().includes(term))
    );

    renderMovies(filtered);
}

document.addEventListener('DOMContentLoaded', () => {
    loadOttMovies(true);

    ottMoviesSearchBtn?.addEventListener('click', handleSearch);
    ottMoviesSearchInput?.addEventListener('keypress', e => {
        if (e.key === 'Enter') handleSearch();
    });

    ottPlatformFilter?.addEventListener('change', () => {
        currentPlatformFilter = ottPlatformFilter.value;
        loadOttMovies(true);
    });

    loadMoreBtn?.addEventListener('click', () => {
        loadOttMovies(false);
    });
});
