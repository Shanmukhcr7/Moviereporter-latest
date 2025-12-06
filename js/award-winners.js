import { db } from './firebase-init.js';
import {
  collection, query, where, getDocs, orderBy,
  doc, getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast } from './utils.js';

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// DOM elements
const yearDropdown = document.getElementById('year-dropdown');
const industrySelector = document.getElementById('winner-industry-selector');
const winnersContainer = document.getElementById('winners-container');
const topYearList = document.getElementById('award-winners-year-list');

let allWinners = [];
const celebCache = new Map(); // 🔁 Cache to avoid refetching celebrities

/**
 * Load all winners and extract unique years.
 */
const loadAvailableYears = async () => {
  try {
    const winnersRef = collection(db, `artifacts/${appId}/winners`);
    const q = query(winnersRef, orderBy('year', 'desc'));
    const snapshot = await getDocs(q);

    const yearsSet = new Set();
    allWinners = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.year) yearsSet.add(data.year);
      allWinners.push({ id: doc.id, ...data });
    });

    const sortedYears = [...yearsSet].sort((a, b) => b - a);

    // Main filter dropdown
    if (yearDropdown) {
      yearDropdown.innerHTML = '<option value="">Select Year</option>';
      sortedYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearDropdown.appendChild(option);
      });
    }

    // Navbar dropdown
    if (topYearList) {
      topYearList.innerHTML = '';
      sortedYears.forEach(year => {
        const li = document.createElement('li');
        li.innerHTML = `<a href="award-winners.html?year=${year}">${year}</a>`;
        topYearList.appendChild(li);
      });
    }

  } catch (err) {
    console.error("Error loading years:", err);
    showToast("Failed to load award winners.", "error");
  }
};

/**
 * Load and display winner cards by year + industry.
 */
const displayWinners = async (year, industry) => {
  winnersContainer.innerHTML = '<div class="loading-spinner">Loading winners...</div>';

  if (!year || !industry) {
    winnersContainer.innerHTML = '<p>Please select both year and industry.</p>';
    return;
  }

  const filtered = allWinners.filter(w => String(w.year) === String(year) && w.industry === industry);

  if (filtered.length === 0) {
    winnersContainer.innerHTML = '<p>No winners found for selected year and industry.</p>';
    return;
  }

  winnersContainer.innerHTML = '';

  for (const winner of filtered) {
    try {
      let celebrityId = null;
      let celebrityName = winner.celebrityName || 'Unknown';
      let celebrityPhoto = winner.celebrityPhoto || 'https://placehold.co/150x150?text=No+Photo';
      const category = winner.categoryName || winner.category || 'Category Unknown';

      if (winner.celebrityId) {
        const nomineeSnap = await getDoc(doc(db, `artifacts/${appId}/nominees`, winner.celebrityId));
        if (nomineeSnap.exists()) {
          celebrityId = nomineeSnap.data().celebrityId || null;
        }
      }

      if (celebrityId) {
        if (!celebCache.has(celebrityId)) {
          const celebSnap = await getDoc(doc(db, `artifacts/${appId}/celebrities`, celebrityId));
          if (celebSnap.exists()) {
            celebCache.set(celebrityId, celebSnap.data());
          }
        }
        const celebData = celebCache.get(celebrityId);
        celebrityName = celebData?.name || celebrityName;
        celebrityPhoto = celebData?.imageUrl || celebData?.photoUrl || celebrityPhoto;
      }

      const card = document.createElement('div');
      card.className = 'winner-card';
      card.innerHTML = `
        <div class="winner-thumbnail" style="cursor: pointer;">
          <img loading="lazy" src="${celebrityPhoto}" alt="${celebrityName}" onerror="this.src='https://placehold.co/150x150?text=No+Photo'" />
          <div class="winner-info">
            <h4 tabindex="0">${celebrityName}</h4>
            <p class="category-label">${category}</p>
          </div>
        </div>
      `;

      if (celebrityId) {
        card.addEventListener('click', () => {
          window.location.href = `celebrity-profile.html?id=${celebrityId}`;
        });
      }

      winnersContainer.appendChild(card);
    } catch (err) {
      console.error("Error displaying winner:", err);
      winnersContainer.innerHTML += '<p class="error-msg">Error loading a winner. Please try again.</p>';
    }
  }
};

/**
 * Get ?year= param from URL
 */
const getPreselectedYearFromURL = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('year') || '';
};

// Init
document.addEventListener('DOMContentLoaded', () => {
  loadAvailableYears().then(() => {
    const preselectedYear = getPreselectedYearFromURL();

    if (preselectedYear && yearDropdown) {
      yearDropdown.value = preselectedYear;
    }

    // Delay to ensure dropdown value is present
    setTimeout(() => {
      if (preselectedYear && industrySelector?.value) {
        displayWinners(preselectedYear, industrySelector.value);
      }
    }, 50);
  });

  yearDropdown?.addEventListener('change', () => {
    displayWinners(yearDropdown.value, industrySelector.value);
  });

  industrySelector?.addEventListener('change', () => {
    displayWinners(yearDropdown.value, industrySelector.value);
  });
});
