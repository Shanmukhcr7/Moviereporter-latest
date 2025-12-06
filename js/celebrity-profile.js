// js/celebrity-profile.js
import { db } from './firebase-init.js';
import { collection, query, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast } from './utils.js';

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const celebrityListContainer = document.getElementById('celebrity-list');
const celebritySearchInput = document.getElementById('celebrity-search-input');
const celebritySearchBtn = document.getElementById('celebrity-search-btn');
const loadMoreBtn = document.getElementById('load-more-btn');

let allCelebritiesData = [];   // All fetched celebrities
let renderIndex = 0;
const CHUNK_SIZE = 16;

const safeLower = str => str?.toLowerCase() ?? '';

// ✅ Generate HTML for one celebrity card
function createCelebrityCardHtml(celebrity, celebrityId, highlightTerm = '') {
  const nameHighlighted = highlightTerm
    ? celebrity.name.replace(
        new RegExp(`(${highlightTerm})`, 'gi'),
        '<mark>$1</mark>'
      )
    : celebrity.name;

  return `
  <div class="celebrity-card" data-celebrity-id="${celebrityId}">
    <img src="${celebrity.imageUrl || 'https://placehold.co/120x120/333/eee?text=Photo'}"
         alt="${celebrity.name}" 
         onerror="this.onerror=null;this.src='https://placehold.co/120x120/333/eee?text=Photo';">
    <div class="celebrity-card-content">
      <div>
        <h3>${nameHighlighted}</h3>
        <p class="role">${celebrity.role || 'N/A'}</p>
        <p class="text-xs">${celebrity.industry || ''}</p>
      </div>
      <button class="btn view-more-btn" data-viewmore-id="${celebrityId}">View More</button>
    </div>
  </div>
`;

}

// ✅ Render next chunk of celebrities
function renderNextChunk(highlightTerm = '') {
  const chunk = allCelebritiesData.slice(renderIndex, renderIndex + CHUNK_SIZE);
  chunk.forEach(c => {
    celebrityListContainer.innerHTML += createCelebrityCardHtml(c.data, c.id, highlightTerm);
  });
  renderIndex += CHUNK_SIZE;

  if (renderIndex < allCelebritiesData.length) {
    loadMoreBtn.style.display = 'inline-block';
  } else {
    loadMoreBtn.style.display = 'none';
  }
}

// ✅ Search handling
function handleSearch() {
  const term = celebritySearchInput.value.trim().toLowerCase();

  if (!term) {
    celebrityListContainer.innerHTML = '';
    renderIndex = 0;
    renderNextChunk(); // Reset list
    return;
  }

  const filtered = allCelebritiesData.filter(({ data }) =>
    safeLower(data.name).includes(term)
  );

  celebrityListContainer.innerHTML = '';

  if (filtered.length === 0) {
    celebrityListContainer.innerHTML =
      `<p class="text-center text-gray-400">No celebrities found matching "<strong>${term}</strong>".</p>`;
    loadMoreBtn.style.display = 'none';
  } else {
    filtered.forEach(c => {
      celebrityListContainer.innerHTML += createCelebrityCardHtml(c.data, c.id, term);
    });
    loadMoreBtn.style.display = 'none';
  }
}

// ✅ Load celebrities list
async function loadCelebrities() {
  celebrityListContainer.innerHTML =
    '<p class="text-center text-gray-400">Loading celebrities...</p>';
  allCelebritiesData = [];
  renderIndex = 0;

  try {
    const ref = collection(db, `artifacts/${appId}/celebrities`);
    const q = query(ref, orderBy('name', 'asc'));
    const snapshot = await getDocs(q);

    snapshot.forEach(doc => {
      allCelebritiesData.push({ id: doc.id, data: doc.data() });
    });

    celebrityListContainer.innerHTML = '';
    renderNextChunk();

  } catch (error) {
    console.error("Error loading celebrities:", error);
    showToast('Failed to load celebrity profiles.', 'error');
    celebrityListContainer.innerHTML =
      '<p class="text-center text-red-500">Error loading celebrities.</p>';
  }
}

// ✅ Setup events
document.addEventListener('DOMContentLoaded', async () => {
  await loadCelebrities();

  // Search
  celebritySearchBtn?.addEventListener('click', handleSearch);
  celebritySearchInput?.addEventListener('keypress', e => {
    if (e.key === 'Enter') handleSearch();
  });
  celebritySearchInput?.addEventListener('input', handleSearch);

  // Load more
  loadMoreBtn?.addEventListener('click', () => renderNextChunk());

  // Card click → celebrity details page
  celebrityListContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.view-more-btn');
    const card = e.target.closest('.celebrity-card');

    // If View More button clicked
    if (btn) {
      const id = btn.dataset.viewmoreId;
      window.location.href = `celebrity-details.html?celebrityId=${id}`;
      return;
    }

    // Or if card itself clicked
    if (card) {
      const id = card.dataset.celebrityId;
      window.location.href = `celebrity-details.html?celebrityId=${id}`;
    }
  });
});
