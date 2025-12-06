import { db } from './firebase-init.js';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  Timestamp,
  orderBy
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const magazineContainer = document.getElementById('weekly-magazine-container');
const modal = document.getElementById('magazine-detail-modal');
const modalTitle = document.getElementById('modal-article-title');
const modalContent = document.getElementById('modal-article-content');
const modalImage = document.getElementById('modal-article-image');
const closeModalBtn = document.getElementById('close-magazine-modal');

// Get previous week's Monday to Saturday range
const getPreviousWeekRange = () => {
  const today = new Date();
  const day = today.getDay(); // Sunday = 0
  const currentSunday = new Date(today);
  currentSunday.setDate(today.getDate() - day);

  const previousMonday = new Date(currentSunday);
  previousMonday.setDate(currentSunday.getDate() - 6);
  previousMonday.setHours(0, 0, 0, 0);

  const previousSaturday = new Date(currentSunday);
  previousSaturday.setDate(currentSunday.getDate() - 1);
  previousSaturday.setHours(23, 59, 59, 999);

  return {
    start: Timestamp.fromDate(previousMonday),
    end: Timestamp.fromDate(previousSaturday)
  };
};

// Render a card for each article
const renderCard = (docSnap, type) => {
  const data = docSnap.data();
  return `
    <div class="magazine-card">
      <img src="${data.imageUrl || 'https://placehold.co/400x200?text=No+Image'}" alt="${data.title}" loading="lazy">
      <div class="card-content">
        <h3>${data.title}</h3>
        <p>${data.content?.slice(0, 150) || ''}...</p>
        <a href="javascript:void(0)" class="read-more-link"
           data-id="${docSnap.id}"
           data-type="${type}">
           Read More
        </a>
      </div>
    </div>
  `;
};

// Attach modal events to article links
const attachModalEvents = () => {
  document.querySelectorAll('.read-more-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      const type = e.currentTarget.dataset.type;
      if (!id || !type) return;

      try {
        const ref = doc(db, `artifacts/${appId}/${type}/${id}`);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        const data = snap.data();
        modalTitle.textContent = data.title || '';
        modalContent.innerHTML = (data.content || '').replace(/\n/g, '<br>');
        modalImage.src = data.imageUrl || 'https://placehold.co/600x300?text=No+Image';
        modal.setAttribute('data-id', id);
        modal.setAttribute('data-type', type);
        modal.style.display = 'flex';
      } catch (err) {
        console.error('Error fetching article:', err);
      }
    });
  });
};

// Load all weekly magazine articles
const loadWeeklyMagazine = async (selectedCategory = '') => {
  if (!magazineContainer) return;
  magazineContainer.innerHTML = '<div class="spinner"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

  try {
    const { start, end } = getPreviousWeekRange();

    const filters = [
      where('weeklyMagazine', '==', true),
      where('scheduledAt', '>=', start),
      where('scheduledAt', '<=', end)
    ];
    if (selectedCategory) {
      filters.push(where('category', '==', selectedCategory));
    }

    const newsQuery = query(
      collection(db, `artifacts/${appId}/news`),
      ...filters,
      orderBy('scheduledAt', 'desc')
    );

    const blogQuery = query(
      collection(db, `artifacts/${appId}/blogs`),
      ...filters,
      orderBy('scheduledAt', 'desc')
    );

    const [newsSnap, blogsSnap] = await Promise.all([
      getDocs(newsQuery),
      getDocs(blogQuery)
    ]);

    if (newsSnap.empty && blogsSnap.empty) {
      magazineContainer.innerHTML = `<p class="text-center" style="color:black;">No weekly magazine articles found${selectedCategory ? ` in ${selectedCategory}` : ''}.</p>`;
      return;
    }

    let html = '';
    newsSnap.forEach(doc => html += renderCard(doc, 'news'));
    blogsSnap.forEach(doc => html += renderCard(doc, 'blogs'));

    magazineContainer.innerHTML = `<div class="magazine-grid">${html}</div>`;
    attachModalEvents();
  } catch (err) {
    console.error('Failed to load weekly magazine:', err);
    magazineContainer.innerHTML = `<p class="text-error">Something went wrong. Please try again later.</p>`;
  }
};

// Close modal
if (closeModalBtn) {
  closeModalBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
}

// Close modal when clicking outside
if (modal) {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
}

// Share logic (reusing modal data attributes)
const shareBtn = document.getElementById('share-article-btn');
if (shareBtn) {
  shareBtn.onclick = async () => {
    const docId = modal.getAttribute('data-id');
    const type = modal.getAttribute('data-type');
    const shareUrl = `${window.location.origin}/${type}.html?id=${docId}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: modalTitle.textContent,
          text: 'Check out this article on Movie Reporter!',
          url: shareUrl,
        });
        showToast('Shared successfully!', 'success');
      } else {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Link copied to clipboard!', 'info');
      }
    } catch (err) {
      console.error('Sharing failed:', err);
      alert('Failed to share or copy link.');
    }
  };
}

// Initialize with optional category filter
document.addEventListener('DOMContentLoaded', () => {
  const filterSelect = document.getElementById('category-filter');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      const selected = e.target.value;
      loadWeeklyMagazine(selected);
    });
  }

  loadWeeklyMagazine(); // Initial load
});
