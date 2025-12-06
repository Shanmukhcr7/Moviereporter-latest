// js/movie-details.js

import { db } from './firebase-init.js';
import {
  doc, getDoc, getDocs, collection,
  query, where, orderBy, Timestamp, increment,updateDoc, setDoc,deleteDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, formatDate } from './utils.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const movieDetailsContent = document.getElementById('movie-details-content');
const auth = getAuth();
let currentUser = null;
let currentUserId = null;

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


onAuthStateChanged(auth, (user) => {
  currentUser = user;
  currentUserId = user?.uid || null;
});
async function renderMovieDetails(movie, movieId = '') {
  if (!movieDetailsContent) return;

  const releaseDate = movie.releaseDate?.toDate ? formatDate(movie.releaseDate.toDate()) : 'N/A';
  const genre = Array.isArray(movie.genre) ? movie.genre.join(', ') : 'N/A';
  const industry = movie.industry || 'N/A';
  const castListHtml = await renderCastList(movie.cast, movieId);
  const reviewsListHtml = '<p class="text-gray-400">No reviews yet.</p>';

  // ✅ OTT Availability
  let ottHtml = '';
  if (Array.isArray(movie.ottPlatforms) && movie.ottPlatforms.length > 0) {
    ottHtml += `<div class="ott-section" style="margin-bottom: 20px;">
      <h2 style="color: var(--primary-color);">Available On</h2>
      <div class="ott-logos" style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px;">`;

    movie.ottPlatforms.forEach(platform => {
      const key = platform.toLowerCase().trim();
      const imgSrc = ottPlatformImages[key] || 'default-ott.webp';
      ottHtml += `
        <div class="ott-logo" title="${platform}">
          <img src="assets/ott/${imgSrc}" alt="${platform}" style="width: 50px; height: 50px; object-fit: contain;" />
        </div>`;
    });

    ottHtml += `</div></div>`;
  }

  // ✅ Trailer Embed
  let trailerEmbedHtml = '';
  if (movie.trailerLink) {
    const ytRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = movie.trailerLink.match(ytRegex);
    const videoId = match ? match[1] : null;

    if (videoId) {
      trailerEmbedHtml = `
        <div class="trailer-embed" style="margin: 25px 0;">
          <h2 style="color: var(--primary-color);">Watch Trailer</h2>
          <div class="plyr__video-embed" id="player" style="border-radius: 12px; overflow: hidden;">
            <iframe
              src="https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1"
              allowfullscreen
              allow="autoplay; encrypted-media"
            ></iframe>
          </div>
        </div>`;
    }
  }

  // ✅ Main Content Render
  movieDetailsContent.innerHTML = `
    <div class="movie-detail-container">
      <img id="detail-poster" src="${movie.posterUrl || 'https://placehold.co/350x500/333/eee?text=No+Poster'}"
        alt="${movie.title}" class="movie-poster-large"
        onerror="this.onerror=null;this.src='https://placehold.co/350x500/333/eee?text=No+Poster';" />

      <div class="reaction-buttons" style="margin: 12px 0;">
        <button id="like-btn" class="reaction-btn"><i class="fas fa-thumbs-up"></i> Like <span id="like-count">0</span></button>
        <button id="dislike-btn" class="reaction-btn"><i class="fas fa-thumbs-down"></i> Dislike <span id="dislike-count">0</span></button>
      </div>

      <div class="movie-info-content">
        <h1 id="detail-title">${movie.title}</h1>
        <div class="meta-info">
          <span id="detail-genre">Genre: ${genre}</span>
          <span id="detail-industry">Industry: ${industry}</span>
          <span id="detail-release-date">Release Date: ${releaseDate}</span>
        </div>

        <button id="movie-share-btn" class="btn secondary" style="margin-bottom: 10px;">
          <i class="fas fa-share-alt"></i> Share
        </button>

        ${ottHtml}
        ${trailerEmbedHtml}

        <p id="detail-description" class="description">
  ${(movie.description || 'No description available.').replace(/\n/g, '<br>')}
</p>


        <h2>Cast</h2>
        <ul id="detail-cast-list" class="cast-list">${castListHtml}</ul>

        <h2>Reviews</h2>
        <ul id="detail-reviews-list" class="review-list">${reviewsListHtml}</ul>
      </div>
    </div>
  `;

  // ✅ Init Plyr
  if (window.Plyr) new Plyr('#player', { youtube: { noCookie: true } });

  // ✅ Share Logic
  const shareBtn = document.getElementById('movie-share-btn');
  if (shareBtn) {
    shareBtn.onclick = () => {
      const shareText = `Check out "${movie.title}" on Movie Reporter! 🎬`;
      const shareUrl = window.location.href;
      if (navigator.share) {
        navigator.share({ title: movie.title, text: shareText, url: shareUrl })
          .catch(() => tryToast('Sharing failed or cancelled.', 'info'));
      } else {
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
          '_blank'
        );
      }
    };
  }

  // ✅ Like/Dislike Logic
  const likeBtn = document.getElementById('like-btn');
  const dislikeBtn = document.getElementById('dislike-btn');
  const likeCountSpan = document.getElementById('like-count');
  const dislikeCountSpan = document.getElementById('dislike-count');

  if (!currentUser || !currentUserId) {
    likeBtn.disabled = true;
    dislikeBtn.disabled = true;
    return;
  }

  const reactionsRef = collection(db, `artifacts/${appId}/movies/${movieId}/movieReactions`);
  const userReactionRef = doc(reactionsRef, currentUserId);

  const allReactionsSnap = await getDocs(reactionsRef);
  let likeCount = 0;
  let dislikeCount = 0;
  let currentReaction = null;

  allReactionsSnap.forEach(docSnap => {
    const r = docSnap.data().reaction;
    if (r === 'like') likeCount++;
    else if (r === 'dislike') dislikeCount++;
    if (docSnap.id === currentUserId) currentReaction = r;
  });

  likeCountSpan.textContent = likeCount;
  dislikeCountSpan.textContent = dislikeCount;

  updateReactionUI(currentReaction);

  likeBtn.onclick = async () => {
    if (currentReaction === 'like') {
      await deleteDoc(userReactionRef);
      likeCount--;
      currentReaction = null;
      updateReactionUI(null);
      likeCountSpan.textContent = likeCount;
      showToast('Removed your like.', 'info');
    } else {
      await setDoc(userReactionRef, { reaction: 'like', timestamp: Timestamp.now() });
      likeCount++;
      if (currentReaction === 'dislike') dislikeCount--;
      currentReaction = 'like';
      updateReactionUI('like');
      likeCountSpan.textContent = likeCount;
      dislikeCountSpan.textContent = dislikeCount;
      showToast('You liked this movie.', 'success');
    }
  };

  dislikeBtn.onclick = async () => {
    if (currentReaction === 'dislike') {
      await deleteDoc(userReactionRef);
      dislikeCount--;
      currentReaction = null;
      updateReactionUI(null);
      dislikeCountSpan.textContent = dislikeCount;
      showToast('Removed your dislike.', 'info');
    } else {
      await setDoc(userReactionRef, { reaction: 'dislike', timestamp: Timestamp.now() });
      dislikeCount++;
      if (currentReaction === 'like') likeCount--;
      currentReaction = 'dislike';
      updateReactionUI('dislike');
      likeCountSpan.textContent = likeCount;
      dislikeCountSpan.textContent = dislikeCount;
      showToast('You disliked this movie.', 'info');
    }
  };

  function updateReactionUI(reaction) {
    likeBtn.classList.toggle('liked', reaction === 'like');
    dislikeBtn.classList.toggle('disliked', reaction === 'dislike');
  }
}

async function renderCastList(cast, fromMovieId = '') {
  if (!Array.isArray(cast) || cast.length === 0) return '<li>N/A</li>';

  const items = await Promise.all(cast.map(async (person) => {
    try {
      const celebRef = doc(db, `artifacts/${appId}/celebrities`, person.id);
      const celebSnap = await getDoc(celebRef);
      const celebData = celebSnap.exists() ? celebSnap.data() : null;

      const name = celebData?.name || person.name || 'Unknown';
      const imageUrl = celebData?.imageUrl || 'https://placehold.co/80x80/333/eee?text=Photo';

      return `
        <li style="display: flex; align-items: center; gap: 12px;">
          <a href="celebrity-profile.html?id=${person.id}&type=celebrity${fromMovieId ? `&fromMovie=${fromMovieId}` : ''}" 
             style="display: flex; align-items: center; text-decoration: none; color: inherit;">
            <img src="${imageUrl}" alt="${name}" width="50" height="50"
                 style="border-radius: 50%; object-fit: cover;"
                 onerror="this.onerror=null;this.src='https://placehold.co/80x80/333/eee?text=Photo';" />
            <span>${name}</span>
          </a>
        </li>
      `;
    } catch (err) {
      console.warn(`Cast fetch error for ID ${person.id}:`, err);
      return `<li>${person.name || 'Unknown'}</li>`;
    }
  }));

  return items.join('');
}

async function loadMovieDetails() {
  const urlParams = new URLSearchParams(window.location.search);

  // ✅ Prevent reload if redirected from celebrity modal
  const type = urlParams.get('type');
  const id = urlParams.get('id');
  if (type === 'celebrity' && id) {
    return; // Modal logic is handled by celebrity-profile.js
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });

  const movieId = urlParams.get('movieId');
  if (!movieId || !movieDetailsContent) {
    movieDetailsContent.innerHTML = '<p class="error-message">Movie ID not provided.</p>';
    showToast('Movie ID missing.', 'error');
    return;
  }

  movieDetailsContent.innerHTML = '<p class="loading-message">Loading movie details...</p>';

  try {
    const movieRef = doc(db, `artifacts/${appId}/movies`, movieId);
    const movieSnap = await getDoc(movieRef);

    if (!movieSnap.exists()) {
      movieDetailsContent.innerHTML = '<p class="error-message">Movie not found.</p>';
      showToast('Movie does not exist.', 'error');
      return;
    }

    const movieData = movieSnap.data();
    const now = Timestamp.now();

    if (!movieData.scheduledAt || movieData.scheduledAt.toMillis() > now.toMillis()) {
      movieDetailsContent.innerHTML = '<p class="error-message">This movie is not yet published.</p>';
      showToast('Movie not yet scheduled to be published.', 'warning');
      return;
    }

    await renderMovieDetails(movieData, movieId);
    await loadMovieReviews(movieId);

  } catch (err) {
    console.error('Error loading movie:', err);
    movieDetailsContent.innerHTML = '<p class="error-message">Failed to load movie.</p>';
    showToast('Could not load movie.', 'error');
  }
}


async function loadMovieReviews(movieId) {
  const reviewsList = document.getElementById('detail-reviews-list');
  if (!reviewsList) return;

  reviewsList.innerHTML = '<p class="loading-message">Loading reviews...</p>';

  try {
    const q = query(
      collection(db, `artifacts/${appId}/reviews`),
      where('movieId', '==', movieId),
      where('approved', '==', true),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      reviewsList.innerHTML = '<p class="text-gray-400">No reviews yet.</p>';
      return;
    }

    reviewsList.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();

      // ✅ Reviewer info
      const name = data.userName || "Anonymous";
      const rating = data.rating || 0;
      const reviewText = data.review || "No review text provided.";
      const createdAt = data.createdAt?.toDate
        ? formatDate(data.createdAt.toDate())
        : "Unknown date";

      // ✅ Stars rendering
      const stars = "⭐".repeat(rating) + "☆".repeat(5 - rating);

      // ✅ Build review item
      const li = document.createElement("li");
      li.innerHTML = `
        <p class="reviewer-info">${name} - ${stars}</p>
        <p class="review-text">${reviewText}</p>
        <small style="color:gray;">Posted on ${createdAt}</small>
      `;

      fragment.appendChild(li);
    }

    reviewsList.appendChild(fragment);
  } catch (err) {
    console.error("Error loading reviews:", err);
    reviewsList.innerHTML = '<p class="error-message">Failed to load reviews.</p>';
    showToast("Could not load reviews.", "error");
  }
}


document.addEventListener('DOMContentLoaded', loadMovieDetails);
