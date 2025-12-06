// js/main.js - This file handles both global UI functionalities and homepage-specific content loading.

import { db, isAuthReady } from './firebase-init.js';
import { auth } from './firebase-init.js'; // Ensure auth is imported for UI updates
import { collection, query, limit, getDocs, doc, getDoc, orderBy, where, Timestamp, startAfter,updateDoc, increment,setDoc} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { showToast, formatDate, formatDateTime } from './utils.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
// Get app ID from global variable
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const yearDropdownEl = document.getElementById('award-winners-year-list');

// Hero Carousel State and Constants
let heroCurrentSlideIndex = 0;
let heroSlideInterval;
const AUTO_PLAY_INTERVAL = 5000; // 5 seconds for hero banner auto-play

// DOM Elements for the new marquee (homepage specific)
const latestUpdatesMarquee = document.getElementById('latest-updates-marquee');

// DOM elements for header navigation and auth status (global)
const loginLink = document.getElementById('login-link');
const logoutButton = document.getElementById('logout-button');
const profileLink = document.querySelector('.profile-link');
const adminDashboardLink = document.querySelector('.admin-dashboard-link');

// Pagination state variables for "Load More"
let lastVisibleMovie = null;
let lastVisibleFeaturedNews = null;
let lastVisibleFeaturedBlog = null;
let lastVisibleUpcoming = null;
let lastVisibleCelebrity = null;

const INITIAL_LOAD_LIMIT = 8; // Initial number of items to load for lists/grids
const LOAD_MORE_LIMIT = 4; // Number of additional items to load when "Load More" is clicked

// Generic spinner HTML
const spinnerHtml = `
    <div class="spinner">
        <i class="fas fa-spinner fa-spin"></i> Loading...
    </div>
`;

/**
 * Shows a loading spinner in the specified container.
 * @param {HTMLElement} container The DOM element to insert the spinner into.
 */
const showSpinner = (container) => {
    if (container) {
        container.innerHTML = spinnerHtml;
    }
};

/**
 * Hides the loading spinner from the specified container.
 * @param {HTMLElement} container The DOM element to clear the spinner from.
 */
const hideSpinner = (container) => {
    if (container) {
        // Only clear if the spinner is the current content
        if (container.querySelector('.spinner')) {
            container.innerHTML = '';
        }
    }
};

/**
 * Updates the visibility of login/logout links based on user authentication status.
 * Also shows/hides profile and admin dashboard links.
 * This is a global UI function.
 */
const updateAuthUI = (user) => {
    if (loginLink && logoutButton && profileLink && adminDashboardLink) {
        if (user) {
            // User is logged in
            loginLink.style.display = 'none';
            logoutButton.style.display = 'inline-block';
            profileLink.style.display = 'list-item'; // Show profile link

            // Check for admin custom claim
            user.getIdTokenResult().then(idTokenResult => {
                if (idTokenResult.claims.admin) {
                    adminDashboardLink.style.display = 'list-item'; // Show admin dashboard
                } else {
                    adminDashboardLink.style.display = 'none';
                }
            }).catch(error => {
                console.error("Error getting ID token result:", error);
                adminDashboardLink.style.display = 'none'; // Hide on error
            });
        } else {
            // User is logged out
            loginLink.style.display = 'inline-block';
            logoutButton.style.display = 'none';
            profileLink.style.display = 'none'; // Hide profile link
            adminDashboardLink.style.display = 'none'; // Hide admin dashboard
        }
    }
};

/**
 * Handles user logout.
 * This is a global UI function.
 */
const handleLogout = async () => {
    try {
        await signOut(auth);
        showToast('Logged out successfully!', 'info');
        window.location.href = '/'; // Redirect to homepage after logout
    } catch (error) {
        console.error("Error during logout:", error);
        showToast(`Logout failed: ${error.message}`, 'error');
    }
};

/**
 * Fetches and displays the hero banners: latest 2 News and latest 2 Blog articles.
 * This function is specific to the homepage.
 */
const loadHeroBanners = async () => {
  const heroBackgroundBanners = document.getElementById('hero-background-banners');
  const heroIndicatorsContainer = document.getElementById('hero-carousel-indicators');
  const heroCtaButton = document.getElementById('hero-cta-button');
  const heroTitle = document.querySelector('.hero-content h1');
  const heroParagraph = document.querySelector('.hero-content p');

  if (!heroBackgroundBanners || !heroIndicatorsContainer || !heroCtaButton || !heroTitle || !heroParagraph) {
    console.error("CRITICAL ERROR: Hero section DOM elements missing.");
    return;
  }

  showSpinner(heroBackgroundBanners);
  heroIndicatorsContainer.innerHTML = '';
  heroTitle.textContent = 'Loading...';
  heroParagraph.textContent = 'Fetching the latest content.';
  heroCtaButton.style.display = 'none';

  try {
    const fetchedContent = [];

    // Helper to fetch promotion content
    const fetchPromo = async (type, limitCount) => {
      const ref = collection(db, `artifacts/${appId}/${type}`);
      const q = query(
        ref,
        where('scheduledAt', '<=', Timestamp.now()),
        where('isPromotion', '==', true),
        orderBy('scheduledAt', 'desc'),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        type,
        scheduledAt: doc.data().scheduledAt?.toDate() || new Date(0)
      }));
    };

    const promoNews = await fetchPromo('news', 7);
    const promoBlogs = await fetchPromo('blogs', 7);
    const promos = [...promoNews, ...promoBlogs];

    // Sort all promos by scheduledAt descending
    promos.sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());

    const bannersToShow = promos.slice(0, 7); // max 7 banners

    heroBackgroundBanners.innerHTML = '';

    if (bannersToShow.length === 0) {
      heroBackgroundBanners.innerHTML = '<p class="no-data-message" style="color:white;">No promoted banners found.</p>';
      heroTitle.textContent = 'Welcome to Movie Reporter';
      heroParagraph.textContent = 'Your ultimate destination for movie reviews, news, blogs, and awards!';
      heroCtaButton.textContent = 'Explore Content';
      heroCtaButton.href = '#';
      heroCtaButton.style.display = 'inline-block';
      return;
    }

    bannersToShow.forEach((item, index) => {
      const defaultImageUrl = item.type === 'news'
        ? 'https://placehold.co/1200x400/673AB7/FF0000?text=NEWS+IMG+DEFAULT'
        : 'https://placehold.co/1200x400/7E57C2/00FF00?text=BLOG+IMG+DEFAULT';

      const itemLink = `${item.type === 'news' ? 'news' : 'blogs'}.html?id=${item.id}&type=${item.type}`;
      const bannerHtml = `
        <div class="hero-banner-slide ${index === 0 ? 'active' : ''}"
            data-type="${item.type}"
            data-link="${itemLink}"
            data-title="${item.title || 'Untitled'}"
            data-description="${(item.content?.replace(/<[^>]+>/g, '').substring(0, 80) || 'No description') + '...'}"
            tabindex="0" role="link">
          <img src="${item.imageUrl || defaultImageUrl}"
                alt="${item.title || 'Banner Image'}"
                onerror="this.onerror=null;this.src='${defaultImageUrl}';"
                loading="lazy"
                style="width: 100%; height: 100%; object-fit: cover;">
        </div>
      `;
      heroBackgroundBanners.insertAdjacentHTML('beforeend', bannerHtml);

      const dot = document.createElement('span');
      dot.classList.add('indicator-dot');
      if (index === 0) dot.classList.add('active');
      dot.dataset.slideIndex = index;
      dot.setAttribute('aria-label', `Go to slide ${index + 1}`);
      dot.setAttribute('role', 'button');
      dot.setAttribute('tabindex', '0');
      heroIndicatorsContainer.appendChild(dot);
    });

    setupHeroBannerCarousel();

    document.querySelectorAll('.hero-banner-slide').forEach(slide => {
      slide.addEventListener('click', () => {
        const link = slide.dataset.link;
        if (link && link !== '#') window.location.href = link;
      });
      slide.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          const link = slide.dataset.link;
          if (link && link !== '#') window.location.href = link;
        }
      });
    });

    heroCtaButton.style.display = 'inline-block';
  } catch (err) {
    console.error("Error loading hero banners:", err);
    showToast("Failed to load hero banners.", "error");
    heroBackgroundBanners.innerHTML = '<p class="no-data-message" style="color:white;">Error loading banners.</p>';
    heroTitle.textContent = 'Welcome to Movie Reporter';
    heroParagraph.textContent = 'Your ultimate destination for movie reviews, news, blogs, and awards!';
    heroCtaButton.textContent = 'Explore Content';
    heroCtaButton.href = '#';
    heroCtaButton.style.display = 'inline-block';
  }
};


/**
 * Sets up the hero banner carousel functionality.
 * This function is specific to the homepage.
 */
const setupHeroBannerCarousel = () => {
    const slides = document.querySelectorAll('.hero-banner-slide');
    const dots = document.querySelectorAll('.indicator-dot');
    const heroCtaButton = document.getElementById('hero-cta-button');
    const heroTitle = document.querySelector('.hero-content h1');
    const heroParagraph = document.querySelector('.hero-content p');
    const prevArrow = document.getElementById('hero-carousel-prev');
    const nextArrow = document.getElementById('hero-carousel-next');
    const bannerWrapper = document.querySelector('.hero-background-banners');

    const totalSlides = slides.length;
    if (totalSlides === 0 || !heroCtaButton || !heroTitle || !heroParagraph) return;

    const updateCtaAndText = () => {
        const activeSlide = slides[heroCurrentSlideIndex];
        if (!activeSlide) return;

        const dataType = activeSlide.dataset.type;
        const dataLink = activeSlide.dataset.link;
        const dataTitle = activeSlide.dataset.title;
        const dataDescription = activeSlide.dataset.description || '';

        heroCtaButton.href = dataLink;
        heroTitle.textContent = dataTitle;

        switch (dataType) {
            case 'news':
                heroCtaButton.textContent = 'Read News';
                heroParagraph.textContent = dataDescription || 'Stay informed with the latest updates from the entertainment industry.';
                break;
            case 'blogs':
                heroCtaButton.textContent = 'Read Blog';
                heroParagraph.textContent = dataDescription || 'Dive deep into insightful articles and discussions from our experts.';
                break;
            case 'movie':
                heroCtaButton.textContent = 'View Movie';
                heroParagraph.textContent = dataDescription || 'Discover the latest blockbusters and cinematic masterpieces.';
                break;
            default:
                heroCtaButton.textContent = 'Discover More';
                heroParagraph.textContent = 'Discover more captivating content on Movie Reporter!';
                heroCtaButton.href = '#';
        }
    };

    const showSlide = (index) => {
        heroCurrentSlideIndex = (index + totalSlides) % totalSlides;

        slides.forEach((slide, i) => {
            slide.classList.toggle('active', i === heroCurrentSlideIndex);
            slide.setAttribute('aria-hidden', i === heroCurrentSlideIndex ? 'false' : 'true');
        });

        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === heroCurrentSlideIndex);
            if (i === heroCurrentSlideIndex) {
                dot.setAttribute('aria-current', 'true');
            } else {
                dot.removeAttribute('aria-current');
            }
        });

        updateCtaAndText();
    };

    const nextSlide = () => showSlide(heroCurrentSlideIndex + 1);
    const prevSlide = () => showSlide(heroCurrentSlideIndex - 1);

    const resetInterval = () => {
        clearInterval(heroSlideInterval);
        heroSlideInterval = setInterval(nextSlide, AUTO_PLAY_INTERVAL);
    };

    // Initialize
    showSlide(0);
    resetInterval();

    // Dot click
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const index = parseInt(dot.dataset.slideIndex);
            showSlide(index);
            resetInterval();
        });

        dot.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                const index = parseInt(dot.dataset.slideIndex);
                showSlide(index);
                resetInterval();
            }
        });
    });

    // Arrows
    prevArrow?.addEventListener('click', () => { prevSlide(); resetInterval(); });
    nextArrow?.addEventListener('click', () => { nextSlide(); resetInterval(); });

    // Keyboard navigation
    document.addEventListener('keydown', (event) => {
        const active = document.activeElement;
        if (active === prevArrow || active === nextArrow || active.closest('.hero-section')) {
            if (event.key === 'ArrowLeft') {
                prevSlide();
                resetInterval();
            } else if (event.key === 'ArrowRight') {
                nextSlide();
                resetInterval();
            }
        }
    });

    // ✅ Improved touch swipe support
let startX = 0;
let startY = 0;
let isSwiping = false;

if (bannerWrapper && totalSlides > 1) {
    bannerWrapper.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) return; // ignore multi-touch
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isSwiping = true;
    }, { passive: true });

    bannerWrapper.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;

        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;

        // If vertical scroll is more than horizontal, cancel swipe
        if (Math.abs(dy) > Math.abs(dx)) {
            isSwiping = false;
        }
    }, { passive: true });

    bannerWrapper.addEventListener('touchend', (e) => {
        if (!isSwiping) return;

        const endX = e.changedTouches[0].clientX;
        const diffX = endX - startX;

        if (Math.abs(diffX) > 50) {
            diffX < 0 ? nextSlide() : prevSlide();
            resetInterval();
        }
        isSwiping = false;
    });
}

    // ✅ Improved mouse drag support
let isMouseDragging = false;
let mouseStartX = 0;

if (bannerWrapper && totalSlides > 1) {
    bannerWrapper.addEventListener('mousedown', (e) => {
        isMouseDragging = true;
        mouseStartX = e.clientX;
    });

    bannerWrapper.addEventListener('mousemove', (e) => {
        if (!isMouseDragging) return;
        const diff = e.clientX - mouseStartX;
        if (Math.abs(diff) > 50) {
            diff < 0 ? nextSlide() : prevSlide();
            resetInterval();
            isMouseDragging = false;
        }
    });

    bannerWrapper.addEventListener('mouseup', () => {
        isMouseDragging = false;
    });

    bannerWrapper.addEventListener('mouseleave', () => {
        isMouseDragging = false;
    });
}
};
/**
 * Fetches and displays the latest movies in a carousel.
 * Implements initial load and pagination with "Load More" button.
 * This function is specific to the homepage.
 * @param {boolean} loadMore - True if loading more, false for initial load.
 */
const loadLatestMovies = async (loadMore = false) => {
  const carouselContainer = document.getElementById('latest-movies-carousel');
  if (!carouselContainer) return;

  if (!loadMore) {
    showSpinner(carouselContainer); // Show spinner for initial load
    lastVisibleMovie = null; // Reset for initial load
  } else {
    const existingBtn = document.getElementById('load-more-movies-btn');
    if (existingBtn) {
      existingBtn.textContent = 'Loading...';
      existingBtn.disabled = true;
    }
  }

  try {
    const moviesRef = collection(db, `artifacts/${appId}/movies`);
    const now = Timestamp.now();
    let q;
    const currentLimit = loadMore ? LOAD_MORE_LIMIT : INITIAL_LOAD_LIMIT;

    if (lastVisibleMovie && loadMore) {
      q = query(
        moviesRef,
        where('scheduledAt', '<=', now),
        where('releaseDate', '<=', now),
        orderBy('releaseDate', 'desc'),
        startAfter(lastVisibleMovie),
        limit(currentLimit)
      );
    } else {
      q = query(
        moviesRef,
        where('scheduledAt', '<=', now),
        where('releaseDate', '<=', now),
        orderBy('releaseDate', 'desc'),
        limit(currentLimit)
      );
    }

    const querySnapshot = await getDocs(q);

    if (!loadMore) {
      carouselContainer.innerHTML = ''; // Clear spinner only for initial load
    }

    // Remove any existing Load More button
    const existingBtn = document.getElementById('load-more-movies-btn');
    if (existingBtn) existingBtn.remove();

    if (querySnapshot.empty && !loadMore) {
      carouselContainer.innerHTML = '<p class="no-data-message">No latest movies available yet.</p>';
      return;
    }

    if (querySnapshot.empty && loadMore) {
      showToast('No more latest movies to load.', 'info');
      return;
    }

    lastVisibleMovie = querySnapshot.docs[querySnapshot.docs.length - 1];

    querySnapshot.forEach((doc) => {
      const movie = doc.data();
      const movieCard = `
        <div class="movie-card" data-movie-id="${doc.id}" tabindex="0" role="link" aria-label="${movie.title}">
          <img src="${movie.posterUrl || 'https://placehold.co/200x300/333/eee?text=No+Poster'}" alt="${movie.title} Poster"
            onerror="this.onerror=null;this.src='https://placehold.co/200x300/333/eee?text=No+Poster'; console.error('Failed to load movie poster:', this.src);" loading="lazy">
          <div class="movie-card-info">
            <h4>${movie.title}</h4>
            
            <p>${movie.industry || 'N/A'}</p>
          </div>
        </div>
      `;
      carouselContainer.insertAdjacentHTML('beforeend', movieCard);
    });

    // Attach event listeners to new movie cards
    carouselContainer.querySelectorAll('.movie-card:not([data-listener-added])').forEach(card => {
      card.addEventListener('click', () => {
        const movieId = card.dataset.movieId;
        window.location.href = `movie-details.html?movieId=${movieId}`;
      });
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          const movieId = card.dataset.movieId;
          window.location.href = `movie-details.html?movieId=${movieId}`;
        }
      });
      card.setAttribute('data-listener-added', 'true');
    });

    // Show Load More button if more movies might exist
    if (querySnapshot.docs.length === currentLimit) {
      const loadMoreBtn = document.createElement('button');
      loadMoreBtn.id = 'load-more-movies-btn';
      loadMoreBtn.className = 'load-more-btn inline-load-more';
      loadMoreBtn.textContent = 'Load More Movies';
      loadMoreBtn.addEventListener('click', () => loadLatestMovies(true));
      carouselContainer.appendChild(loadMoreBtn);
    }

  } catch (error) {
    console.error("Error loading latest movies:", error);
    showToast('Failed to load latest movies.', 'error');

    if (!loadMore) {
      carouselContainer.innerHTML = '<p class="no-data-message">Error loading movies. Please try again.</p>';
    }

    const existingBtn = document.getElementById('load-more-movies-btn');
    if (existingBtn) existingBtn.remove();
  }
};


/**
 * Sets up the carousel navigation for a given container.
 * @param {string} containerId The ID of the carousel container.
 * @param {string} prevBtnId The ID of the previous button.
 * @param {string} nextBtnId The ID of the next button.
 * @param {number} scrollAmount The amount to scroll by.
 */
const setupCarouselNavigation = (containerId, prevBtnId, nextBtnId, scrollAmount = 220) => {
    const container = document.getElementById(containerId);
    const prevButton = document.getElementById(prevBtnId);
    const nextButton = document.getElementById(nextBtnId);

    if (!container || !prevButton || !nextButton) {
        console.warn(`WARNING: Carousel elements not found for ${containerId}. Skipping navigation setup.`);
        return;
    }

    prevButton.addEventListener('click', () => {
        container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });

    nextButton.addEventListener('click', () => {
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });
};


/**
 * Fetches and displays featured news and blog articles.
 * Implements initial load and pagination with "Load More" button.
 * This function is specific to the homepage.
 * @param {boolean} loadMore - True if loading more, false for initial load.
 */
let lastVisibleArticleCursor = null; // Global cursor for pagination

const loadFeaturedArticles = async (loadMore = false) => {
    const featuredArticlesContainer = document.getElementById('featured-articles-grid');
    const loadMoreBtn = document.getElementById('load-more-articles-btn');
    if (!featuredArticlesContainer || !loadMoreBtn) return;

    if (!loadMore) {
        showSpinner(featuredArticlesContainer);
        lastVisibleArticleCursor = null;
        loadMoreBtn.style.display = 'none';
    } else {
        loadMoreBtn.textContent = 'Loading...';
        loadMoreBtn.disabled = true;
    }

    try {
        const now = Timestamp.now();

        // Overfetch from both collections
        const perSourceFetch = 6;
        const articles = [];

        const [newsSnap, blogsSnap] = await Promise.all([
            getDocs(query(collection(db, `artifacts/${appId}/news`), where('scheduledAt', '<=', now), orderBy('scheduledAt', 'desc'), orderBy('title'), limit(perSourceFetch))),
            getDocs(query(collection(db, `artifacts/${appId}/blogs`), where('scheduledAt', '<=', now), orderBy('scheduledAt', 'desc'), orderBy('title'), limit(perSourceFetch)))
        ]);

        newsSnap.forEach(doc => {
            articles.push({ ...doc.data(), id: doc.id, type: 'news', scheduledAt: doc.data().scheduledAt?.toDate() || new Date(0) });
        });
        blogsSnap.forEach(doc => {
            articles.push({ ...doc.data(), id: doc.id, type: 'blog', scheduledAt: doc.data().scheduledAt?.toDate() || new Date(0) });
        });

        // Sort all together by scheduledAt descending
        articles.sort((a, b) => b.scheduledAt - a.scheduledAt);

        // Cursor-based pagination
        let filteredArticles = articles;
        if (loadMore && lastVisibleArticleCursor) {
            const { time, id } = lastVisibleArticleCursor;
            filteredArticles = articles.filter(article => {
                const t = article.scheduledAt.getTime();
                return t < time || (t === time && article.id < id); // ensures uniqueness
            });
        }

        const toRender = filteredArticles.slice(0, 4);

        if (!loadMore) {
            featuredArticlesContainer.innerHTML = '';
        }

        if (toRender.length === 0) {
            if (!loadMore) {
                featuredArticlesContainer.innerHTML = '<p class="no-data-message">No featured articles available yet.</p>';
            } else {
                showToast('No more articles to load.', 'info');
            }
            loadMoreBtn.style.display = 'none';
            return;
        }

        toRender.forEach(article => {
            const articleCard = `
                <div class="article-card" data-article-id="${article.id}" data-article-type="${article.type}" aria-label="${article.title}" tabindex="0" role="link">
                    <img src="${article.imageUrl || 'https://placehold.co/300x200/333/eee?text=No+Image'}" alt="${article.title}" onerror="this.onerror=null;this.src='https://placehold.co/300x200/333/eee?text=No+Image';" loading="lazy">
                    <div class="article-card-info">
                        <h4>${article.title}</h4>
                        <p>${article.content ? article.content.substring(0, 100) + '...' : 'No content available.'}</p>
                        <p class="article-meta">By ${article.author || 'Anonymous'}</p>
                    </div>
                </div>
            `;
            featuredArticlesContainer.insertAdjacentHTML('beforeend', articleCard);
        });

        featuredArticlesContainer.querySelectorAll('.article-card:not([data-listener-added])').forEach(card => {
            card.addEventListener('click', () => {
                const type = card.dataset.articleType;
                const id = card.dataset.articleId;
                window.location.href = `${type}.html?id=${id}&type=${type}`;
            });
            card.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    const type = card.dataset.articleType;
                    const id = card.dataset.articleId;
                    window.location.href = `${type}.html?id=${id}&type=${type}`;
                }
            });
            card.setAttribute('data-listener-added', 'true');
        });

        if (filteredArticles.length > 4) {
            loadMoreBtn.style.display = 'block';
            loadMoreBtn.textContent = 'Load More Articles';
            loadMoreBtn.disabled = false;
        } else {
            loadMoreBtn.style.display = 'none';
        }

        const last = toRender[toRender.length - 1];
        if (last) {
            lastVisibleArticleCursor = { time: last.scheduledAt.getTime(), id: last.id };
        }

    } catch (error) {
        console.error("Error loading featured articles:", error);
        showToast('Failed to load articles.', 'error');
        if (!loadMore) {
            featuredArticlesContainer.innerHTML = '<p class="no-data-message">Error loading articles. Please try again.</p>';
        }
        loadMoreBtn.style.display = 'none';
    }
};
const homePollsContainer = document.getElementById('home-polls');

async function loadHomePolls(user) {
  if (!homePollsContainer) return;
  homePollsContainer.innerHTML = '<div class="spinner"><i class="fas fa-spinner fa-spin"></i> Loading polls...</div>';

  try {
    const now = Timestamp.now();
    const q = query(
      collection(db, `artifacts/${appId}/polls`),
      where('startTime', '<=', now),
      where('endTime', '>=', now),
      orderBy('startTime', 'desc'),
      limit(3)
    );

    const snap = await getDocs(q);
    homePollsContainer.innerHTML = '';

    if (snap.empty) {
      homePollsContainer.innerHTML =
        '<p class="text-gray-400 text-center">No active polls right now. Please check back later!</p>';
      return;
    }

    for (const docSnap of snap.docs) {
      const poll = docSnap.data();
      const pollId = docSnap.id;

      // Normalize poll options
      let pollOptions = [];
      if (Array.isArray(poll.options)) {
        pollOptions = poll.options;
      } else if (poll.options && typeof poll.options === 'object') {
        pollOptions = Object.values(poll.options);
      }

      // Skip this poll if any option has isOther === true
      if (pollOptions.some(opt => typeof opt === 'object' && opt.isOther)) continue;

      // Build options HTML
      const optionsHtml = pollOptions
        .map((opt, index) => {
          const optText = typeof opt === 'string' ? opt : (opt.text || `Option ${index + 1}`);
          const img = typeof opt === 'object' && opt.imageUrl ? opt.imageUrl : 'https://placehold.co/400x250/333/eee?text=?';
          return `
            <div class="poll-option-full"
                 data-poll-id="${pollId}"
                 data-option-index="${index}"
                 data-option-text="${encodeURIComponent(optText)}">
              <img src="${img}" alt="${optText}" loading="lazy"
                   onerror="this.onerror=null;this.src='https://placehold.co/400x250/333/eee?text=?';">
              <div class="poll-option-caption">${optText}</div>
            </div>
          `;
        })
        .join('');

      // Create poll card
      const card = document.createElement('div');
      card.className = 'poll-card';
      card.dataset.pollId = pollId;
      card.innerHTML = `
        <h3>${poll.question || 'Untitled Poll'}</h3>
        <div class="poll-options-row">
          ${optionsHtml}
        </div>
      `;
      homePollsContainer.appendChild(card);
    }

    // Attach vote listeners
    document.querySelectorAll('.poll-option-full').forEach(optionEl => {
      optionEl.addEventListener('click', async () => {
        const pollId = optionEl.getAttribute('data-poll-id');
        const optionTextEncoded = optionEl.getAttribute('data-option-text');
        const optionText = optionTextEncoded ? decodeURIComponent(optionTextEncoded) : null;

        if (!user) {
          showToast('Please log in to vote!', 'info');
          return;
        }
        if (!pollId || !optionText) {
          showToast('Invalid poll option.', 'error');
          return;
        }

        try {
          const voteDocRef = doc(db, `artifacts/${appId}/polls/${pollId}/votes`, user.uid);
          await setDoc(voteDocRef, {
            userId: user.uid,
            selectedOption: optionText,
            updatedAt: Timestamp.now()
          }, { merge: true });

          showToast('Vote submitted successfully!', 'success');
        } catch (err) {
          console.error('Error voting (homepage):', err);
          showToast('Failed to submit vote. Try again.', 'error');
        }
      });
    });

  } catch (err) {
    console.error('Error loading polls (homepage):', err);
    showToast('Failed to load polls.', 'error');
    homePollsContainer.innerHTML =
      '<p class="text-red-500 text-center">Failed to load polls.</p>';
  }
}

onAuthStateChanged(auth, user => {
  loadHomePolls(user || null);
});



/**
 * Fetches and displays the latest movies, news, and blog titles for the scrolling marquee.
 * This function is specific to the homepage.
 */
const loadLatestUpdatesMarquee = async () => {
    if (!latestUpdatesMarquee) {
        console.warn("Marquee element not found. Skipping marquee content load.");
        return;
    }

    try {
        const updates = [];

        const now = Timestamp.now();
        const fetchItems = async (type, limitCount) => {
            const ref = collection(db, `artifacts/${appId}/${type}`);
            const q = query(ref, where('scheduledAt', '<=', now), orderBy('scheduledAt', 'desc'), limit(limitCount));
            const snap = await getDocs(q);
            snap.forEach(doc => {
                updates.push({
                    title: doc.data().title,
                    type,
                    scheduledAt: doc.data().scheduledAt?.toDate() || new Date(0),
                    id: doc.id
                });
            });
        };

        await Promise.all([
            fetchItems('movies', 5),
            fetchItems('news', 5),
            fetchItems('blogs', 5)
        ]);

        // Sort by date
        updates.sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());

        if (updates.length === 0) {
            latestUpdatesMarquee.innerHTML = '<span>No latest updates available.</span>';
            return;
        }

        // Icon mapping (match Firestore type)
        const iconMap = {
            movies: 'fa-clapperboard',
            news: 'fa-newspaper',
            blogs: 'fa-pen-nib'
        };

        const colorClasses = ['text-red', 'text-green', 'text-blue', 'text-yellow', 'text-purple', 'text-pink'];

        const marqueeContentHtml = updates.map(item => {
            const icon = iconMap[item.type] || 'fa-bolt';
            const randomColor = colorClasses[Math.floor(Math.random() * colorClasses.length)];
            const link = `${item.type}.html?id=${item.id}`;
            return `
                <span class="marquee-update">
                    <i class="fas ${icon} ${randomColor}" aria-hidden="true" title="${item.type}"></i>
                    <a href="${link}" title="${item.title}" aria-label="${item.type}">${item.title}</a>
                </span>
            `;
        }).join('<span class="separator">|</span>');

        // Duplicate for seamless loop
        latestUpdatesMarquee.innerHTML = marqueeContentHtml + '<span class="separator">|</span>' + marqueeContentHtml;

    } catch (error) {
        console.error("Error loading latest updates for marquee:", error);
        latestUpdatesMarquee.innerHTML = '<span>Error loading updates.</span>';
        showToast('Failed to load latest updates for marquee.', 'error');
    }
};

/**
 * Loads upcoming movie releases.
 * @param {boolean} loadMore - True if loading more, false for initial load.
 */
async function loadUpcomingReleases(loadMore = false) {
  const container = document.getElementById('upcoming-releases-grid');
  if (!container) return;

  if (!loadMore) {
    showSpinner(container);
    lastVisibleUpcoming = null;
  } else {
    const existingBtn = document.getElementById('load-more-upcoming-btn');
    if (existingBtn) {
      existingBtn.textContent = 'Loading...';
      existingBtn.disabled = true;
    }
  }

  try {
    const now = Timestamp.now();
    const currentLimit = loadMore ? LOAD_MORE_LIMIT : INITIAL_LOAD_LIMIT;

    let q;
    if (lastVisibleUpcoming && loadMore) {
      q = query(
        collection(db, `artifacts/${appId}/movies`),
        where('releaseDate', '>', now),
        where('scheduledAt', '<=', now),
        orderBy('releaseDate', 'asc'),
        startAfter(lastVisibleUpcoming),
        limit(currentLimit)
      );
    } else {
      q = query(
        collection(db, `artifacts/${appId}/movies`),
        where('releaseDate', '>', now),
        where('scheduledAt', '<=', now),
        orderBy('releaseDate', 'asc'),
        limit(currentLimit)
      );
    }

    const snap = await getDocs(q);

    if (!loadMore) {
      container.innerHTML = '';
    }

    // Remove any existing Load More button
    const existingBtn = document.getElementById('load-more-upcoming-btn');
    if (existingBtn) existingBtn.remove();

    if (snap.empty && !loadMore) {
      container.innerHTML = '<p class="no-data-message">No upcoming releases found.</p>';
      return;
    }

    if (snap.empty && loadMore) {
      showToast('No more upcoming releases to load.', 'info');
      return;
    }

    lastVisibleUpcoming = snap.docs[snap.docs.length - 1];

    snap.forEach(doc => {
  const movie = doc.data();
  const img = movie.posterUrl || 'https://placehold.co/220x300/333/eee?text=No+Poster';
  const releaseDate = movie.releaseDate?.toDate().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }) || 'TBD';


        container.insertAdjacentHTML('beforeend', `
    <a href="movie-details.html?movieId=${doc.id}" class="upcoming-movie-card" tabindex="0" role="link" aria-label="${movie.title}">
      <img src="${img}" alt="${movie.title}" onerror="this.onerror=null;this.src='https://placehold.co/220x300/333/eee?text=No+Poster';" loading="lazy">
      <h4>${movie.title}</h4>
      <p><strong>Releases on:</strong><br>${releaseDate}</p>
    </a>
  `);

    });

    container.querySelectorAll('.upcoming-movie-card:not([data-listener-added])').forEach(card => {
      card.addEventListener('click', () => {
        const movieId = card.getAttribute('href').split('=')[1];
        window.location.href = `movie-details.html?movieId=${movieId}`;
      });
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          const movieId = card.getAttribute('href').split('=')[1];
          window.location.href = `movie-details.html?movieId=${movieId}`;
        }
      });
      card.setAttribute('data-listener-added', 'true');
    });

    if (snap.docs.length === currentLimit) {
      const loadMoreBtn = document.createElement('button');
      loadMoreBtn.id = 'load-more-upcoming-btn';
      loadMoreBtn.className = 'load-more-btn inline-load-more';
      loadMoreBtn.textContent = 'Load More Upcoming';
      loadMoreBtn.addEventListener('click', () => loadUpcomingReleases(true));
      container.appendChild(loadMoreBtn);
    }

  } catch (err) {
    console.error('Error loading upcoming releases:', err);
    showToast('Failed to load upcoming releases.', 'error');

    if (!loadMore) {
      container.innerHTML = '<p class="no-data-message">Error loading upcoming releases. Please try again.</p>';
    }

    const existingBtn = document.getElementById('load-more-upcoming-btn');
    if (existingBtn) existingBtn.remove();
  }
}


/**
 * Loads celebrity profiles.
 * @param {boolean} loadMore - True if loading more, false for initial load.
 */
async function loadCelebrityProfiles() {
  const container = document.getElementById('celebrity-profiles-grid');
  if (!container) return;

  container.innerHTML = '<div class="spinner"><i class="fas fa-spinner fa-spin"></i> Loading celebrity profiles...</div>';
  lastVisibleCelebrity = null;

  try {
    const q = query(
      collection(db, `artifacts/${appId}/celebrities`),
      orderBy('name', 'asc'),
      limit(INITIAL_LOAD_LIMIT)
    );

    const snap = await getDocs(q);
    container.innerHTML = ''; // Clear spinner

    if (snap.empty) {
      container.innerHTML = '<p class="no-data-message">No celebrity profiles available.</p>';
      return;
    }

    lastVisibleCelebrity = snap.docs[snap.docs.length - 1];

    snap.forEach(doc => {
      const celeb = doc.data();
      const img = celeb.imageUrl || 'https://placehold.co/220x300/333/eee?text=No+Image';

      const card = document.createElement('a');
      card.href = `celebrity-profile.html?id=${doc.id}&type=celebrity`;
      card.className = 'celebrity-card';
      card.tabIndex = 0;
      card.setAttribute('role', 'link');
      card.setAttribute('aria-label', celeb.name);
      card.innerHTML = `
        <img src="${img}" alt="${celeb.name}" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/220x300/333/eee?text=No+Image';">
        <h4>${celeb.name}</h4>
      `;
      container.appendChild(card);
    });

    // Create and append the Load More button dynamically
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.id = 'load-more-celebrities-btn';
    loadMoreBtn.className = 'load-more-btn';
    loadMoreBtn.textContent = 'View All Celebrities';
    loadMoreBtn.style.display = 'block';
    loadMoreBtn.addEventListener('click', () => {
      window.location.href = 'celebrity-profile.html';
    });
    container.appendChild(loadMoreBtn);

  } catch (err) {
    console.error('Error loading celebrities:', err);
    showToast('Failed to load celebrity profiles.', 'error');
    container.innerHTML = '<p class="no-data-message">Error loading celebrity profiles. Please try again.</p>';
  }
}


/**
 * Handles direct content loading if an ID is present in the URL.
 * This function will attempt to call a specific modal opening function
 * on the target page's JavaScript.
 */
const handleDirectContentLoad = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const type = urlParams.get('type'); // 'news', 'blogs', or 'celebrity'

    if (id) {
        // Use a small delay to ensure the target script has fully loaded and exposed its function
        setTimeout(() => {
            if (window.location.pathname.includes('news.html') && type === 'news' && typeof window.openNewsModalById === 'function') {
                window.openNewsModalById(id);
            } else if (window.location.pathname.includes('blogs.html') && type === 'blogs' && typeof window.openBlogModalById === 'function') {
                window.openBlogModalById(id);
            } else if (window.location.pathname.includes('celebrity-profile.html') && type === 'celebrity' && typeof window.openCelebrityProfileModal === 'function') {
                window.openCelebrityProfileModal(id);
            }
        }, 300); // 300ms delay
    }
};


// Main execution block (handles global UI and calls homepage-specific functions if on /)
document.addEventListener('DOMContentLoaded', () => {
    // --- Global UI / Auth Initialization ---
    auth.onAuthStateChanged(user => {
        updateAuthUI(user);
    });

    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    // Hamburger Menu Toggle Logic (Global)
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.main-nav .nav-links');
    const menuOverlay = document.getElementById('menu-overlay');
    const votingFooter = document.getElementById('voting-footer'); // ✅ Grab footer

    if (hamburger && navLinks && menuOverlay) {
        const openIcon = hamburger.querySelector('.fa-bars');
        const closeIcon = hamburger.querySelector('.fa-times');

        hamburger.setAttribute('aria-controls', 'main-nav-links');
        hamburger.setAttribute('aria-expanded', 'false');
        navLinks.id = 'main-nav-links';

        hamburger.addEventListener('click', () => {
            const isOpen = !navLinks.classList.contains('nav-active');
            navLinks.classList.toggle('nav-active');
            menuOverlay.classList.toggle('active', isOpen);

            if (openIcon && closeIcon) {
                openIcon.style.display = isOpen ? 'none' : 'inline-block';
                closeIcon.style.display = isOpen ? 'inline-block' : 'none';
            }

            hamburger.setAttribute('aria-expanded', isOpen);
            document.body.style.overflow = isOpen ? 'hidden' : 'auto';

            // ✅ Hide/Show footer
            if (votingFooter) {
                votingFooter.style.display = isOpen ? 'none' : 'block';
            }
        });

        menuOverlay.addEventListener('click', () => {
            navLinks.classList.remove('nav-active');
            menuOverlay.classList.remove('active');

            if (openIcon && closeIcon) {
                openIcon.style.display = 'inline-block';
                closeIcon.style.display = 'none';
            }

            hamburger.setAttribute('aria-expanded', false);
            document.body.style.overflow = 'auto';

            // ✅ Show footer again
            if (votingFooter) {
                votingFooter.style.display = 'block';
            }
        });

        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                const parent = link.parentElement;
                if (window.innerWidth <= 768 && parent.classList.contains('dropdown')) {
                    return;
                }

                if (navLinks.classList.contains('nav-active')) {
                    navLinks.classList.remove('nav-active');
                    menuOverlay.classList.remove('active');

                    if (openIcon && closeIcon) {
                        openIcon.style.display = 'inline-block';
                        closeIcon.style.display = 'none';
                    }

                    hamburger.setAttribute('aria-expanded', 'false');
                    document.body.style.overflow = 'auto';

                    // ✅ Show footer again
                    if (votingFooter) {
                        votingFooter.style.display = 'block';
                    }
                }
            });
        });

        // Toggle dropdown on mobile
        document.querySelectorAll('.dropdown > a').forEach(dropLink => {
            dropLink.addEventListener('click', function (e) {
                if (window.innerWidth <= 768) {
                    e.preventDefault();
                    const dropdown = this.parentElement;
                    const wasOpen = dropdown.classList.contains('nav-active');

                    document.querySelectorAll('.dropdown.nav-active').forEach(open => {
                        open.classList.remove('nav-active');
                    });

                    if (!wasOpen) {
                        dropdown.classList.add('nav-active');
                    }
                }
            });
        });
    }

    // --- Homepage Content ---
    if (window.location.pathname === '/' || window.location.pathname.includes('/')) {
        const checkAuthAndLoadHomepageContent = () => {
            if (isAuthReady) {
                loadHeroBanners();
                loadLatestMovies();
                loadFeaturedArticles();
                loadUpcomingReleases();
                loadCelebrityProfiles();
                loadLatestUpdatesMarquee();
                setupCarouselNavigation('latest-movies-carousel', 'movies-carousel-prev', 'movies-carousel-next', 220);
                setupCarouselNavigation('upcoming-releases-grid', 'upcoming-carousel-prev', 'upcoming-carousel-next', 200);
                setupCarouselNavigation('celebrity-profiles-grid', 'celebrity-carousel-prev', 'celebrity-carousel-next', 200);
            } else {
                setTimeout(checkAuthAndLoadHomepageContent, 100);
            }
        };
        checkAuthAndLoadHomepageContent();

        document.getElementById('load-more-movies-btn')?.addEventListener('click', () => loadLatestMovies(true));
        document.getElementById('load-more-articles-btn')?.addEventListener('click', () => loadFeaturedArticles(true));
        document.getElementById('load-more-upcoming-btn')?.addEventListener('click', () => loadUpcomingReleases(true));
        document.getElementById('load-more-celebrities-btn')?.addEventListener('click', () => loadCelebrityProfiles(true));
    }

    // Load direct content if on a news/blog page
    handleDirectContentLoad();
});



const loadAwardWinnerYearsDropdown = async () => {
    if (!yearDropdownEl) return;

    try {
        const winnersRef = collection(db, `artifacts/${appId}/winners`);
        const snapshot = await getDocs(winnersRef);
        const yearsSet = new Set();

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.year) {
                yearsSet.add(data.year);
            }
        });

        yearDropdownEl.innerHTML = '';

        const yearsArray = [...yearsSet].sort((a, b) => b - a); // Descending order

        if (yearsArray.length === 0) {
            yearDropdownEl.innerHTML = '<li><span class="text-muted">No winners yet</span></li>';
            return;
        }

        yearsArray.forEach(year => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="award-winners.html?year=${year}">${year}</a>`;
            yearDropdownEl.appendChild(li);
        });
    } catch (error) {
        console.error('Failed to load winner years:', error);
        yearDropdownEl.innerHTML = '<li><span class="text-muted">Failed to load</span></li>';
    }
};

document.addEventListener('DOMContentLoaded', loadAwardWinnerYearsDropdown);

const searchInput = document.getElementById('global-search-input');
const suggestionsBox = document.getElementById('search-suggestions');
const searchOverlay = document.getElementById('search-overlay');
const openSearchBtn = document.querySelector('.search-icon a');
const closeSearchBtn = document.getElementById('close-search');

let searchTimeout;

// Open search overlay
openSearchBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    searchOverlay.style.display = 'flex';
    searchInput.focus();
});

// Close search overlay
closeSearchBtn?.addEventListener('click', () => {
    searchOverlay.style.display = 'none';
    suggestionsBox.style.display = 'none';
    searchInput.value = '';
});

// Close on ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        searchOverlay.style.display = 'none';
        suggestionsBox.style.display = 'none';
        searchInput.value = '';
    }
});

// Handle input with debounce
searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const query = searchInput.value.trim();
    if (query.length < 2) {
        suggestionsBox.style.display = 'none';
        return;
    }

    searchTimeout = setTimeout(() => {
        runLiveSearch(query.toLowerCase());
    }, 300);
});

// 🔍 Search function
async function runLiveSearch(query) {
    suggestionsBox.innerHTML = '';
    suggestionsBox.style.display = 'block';

    const results = [];
    const lowerQuery = query.toLowerCase();

    // Movies
    const moviesSnap = await getDocs(collection(db, `artifacts/${appId}/movies`));
    moviesSnap.forEach(doc => {
        const data = doc.data();
        if ((data.title || '').toLowerCase().includes(lowerQuery)) {
            results.push({
                type: '🎬 Movie',
                title: data.title,
                url: `movie-details.html?movieId=${doc.id}`
            });
        }
    });

    // Celebrities
    const celebritiesSnap = await getDocs(collection(db, `artifacts/${appId}/celebrities`));
    celebritiesSnap.forEach(doc => {
        const data = doc.data();
        if ((data.name || '').toLowerCase().includes(lowerQuery)) {
            results.push({
                type: '🌟 Celebrity',
                title: data.name,
                url: `celebrity-profile.html?id=${doc.id}&type=celebrity` // Corrected URL with type
            });
        }
    });

    // Blogs
    const blogsSnap = await getDocs(collection(db, `artifacts/${appId}/blogs`));
    blogsSnap.forEach(doc => {
        const data = doc.data();
        if ((data.title || '').toLowerCase().includes(lowerQuery)) {
            results.push({
                type: '📝 Blog',
                title: data.title,
                url: `blogs.html?id=${doc.id}&type=blog` // Corrected URL with type
            });
        }
    });

    // News
    const newsSnap = await getDocs(collection(db, `artifacts/${appId}/news`));
    newsSnap.forEach(doc => {
        const data = doc.data();
        if ((data.title || '').toLowerCase().includes(lowerQuery)) {
            results.push({
                type: '🗞️ News',
                title: data.title,
                url: `news.html?id=${doc.id}&type=news` // Corrected URL with type
            });
        }
    });

    // No results
    if (results.length === 0) {
        suggestionsBox.innerHTML = `<div class="no-results">No results found</div>`;
        return;
    }

    // Display top 10 results
    results.slice(0, 10).forEach(item => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = `${item.type}: ${item.title}`;
        div.addEventListener('click', () => {
            window.location.href = item.url;
        });
        suggestionsBox.appendChild(div);
    });
}

// Check voting availability and show footer if any voting is live
const checkVotingFooter = async () => {
    const footer = document.getElementById('voting-footer');
    if (!footer) return;

    try {
        const categoriesRef = collection(db, `artifacts/${appId}/categories`);
        const snapshot = await getDocs(categoriesRef);

        const now = Timestamp.now().toDate();

        const isVotingLive = snapshot.docs.some(doc => {
            const data = doc.data();
            const start = data.startTime?.toDate();
            const end = data.endTime?.toDate();
            return start && end && now >= start && now < end;
        });

        if (isVotingLive) {
            footer.style.display = 'block';
        }
    } catch (error) {
        console.error("Error checking voting footer condition:", error);
    }
};

// Call on page load
document.addEventListener('DOMContentLoaded', () => {
    checkVotingFooter();
});
document.addEventListener('DOMContentLoaded', () => {
    const scrollContainer = document.querySelector('.nav-scroll-container');
    const scrollLeftBtn = document.querySelector('.nav-scroll-arrow.left');
    const scrollRightBtn = document.querySelector('.nav-scroll-arrow.right');

    if (!scrollContainer || !scrollLeftBtn || !scrollRightBtn) {
        console.warn("Secondary nav scroll setup failed — missing elements.");
        return;
    }

    const scrollAmount = 150;

    scrollLeftBtn.addEventListener('click', () => {
        scrollContainer.scrollBy({
            left: -scrollAmount,
            behavior: 'smooth'
        });
    });

    scrollRightBtn.addEventListener('click', () => {
        scrollContainer.scrollBy({
            left: scrollAmount,
            behavior: 'smooth'
        });
    });

    // Optional: hide arrows if not scrollable
    const updateArrowVisibility = () => {
        const maxScrollLeft = scrollContainer.scrollWidth - scrollContainer.clientWidth;
        scrollLeftBtn.style.display = scrollContainer.scrollLeft > 0 ? 'block' : 'none';
        scrollRightBtn.style.display = scrollContainer.scrollLeft < maxScrollLeft ? 'block' : 'none';
    };

    scrollContainer.addEventListener('scroll', updateArrowVisibility);
    window.addEventListener('resize', updateArrowVisibility);
    updateArrowVisibility();
});

function loadGoogleTranslateScript() {
  const script = document.createElement('script');
  script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  document.body.appendChild(script);
}

window.googleTranslateElementInit = function () {
  new google.translate.TranslateElement({
    pageLanguage: 'en',
    autoDisplay: false
  });
};

// Set language cookie manually
function setLanguage(lang) {
  const googTransCookie = `/auto/${lang}`;
  document.cookie = `googtrans=${googTransCookie};path=/`;
  document.cookie = `googtrans=${googTransCookie};domain=${location.hostname};path=/`;
  location.reload(); // Required to apply translation
}

document.addEventListener('DOMContentLoaded', () => {
  loadGoogleTranslateScript();

  const toggleBtn = document.getElementById('custom-translate-toggle');
  const dropdown = document.getElementById('custom-translate-dropdown');
  const select = document.getElementById('custom-translate-select');

  // Toggle dropdown visibility
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  });

  // Hide dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && !toggleBtn.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  // Trigger translation on language select
  select.addEventListener('change', (e) => {
    const lang = e.target.value;
    if (lang) {
      setLanguage(lang);
    }
  });
});



let lastVisibleMagazine = null;
const weeklyMagazineGrid = document.getElementById('weekly-magazine-grid');
const loadMoreMagazinesBtn = document.getElementById('load-more-magazines-btn');

function getPreviousWeekRange() {
  const today = new Date();
  const currentDay = today.getDay(); // Sunday = 0
  const currentSunday = new Date(today);
  currentSunday.setDate(today.getDate() - currentDay); // This week’s Sunday

  const previousMonday = new Date(currentSunday);
  previousMonday.setDate(currentSunday.getDate() - 6); // Previous week’s Monday

  const previousSaturday = new Date(currentSunday);
  previousSaturday.setDate(currentSunday.getDate() - 1); // Previous week’s Saturday

  previousMonday.setHours(0, 0, 0, 0);
  previousSaturday.setHours(23, 59, 59, 999);

  return {
    start: Timestamp.fromDate(previousMonday),
    end: Timestamp.fromDate(previousSaturday)
  };
}

async function loadWeeklyMagazines(loadMore = false) {
  if (!weeklyMagazineGrid || !loadMoreMagazinesBtn) return;

  if (!loadMore) {
    weeklyMagazineGrid.innerHTML = '<div class="spinner"><i class="fas fa-spinner fa-spin"></i> Loading weekly magazines...</div>';
    lastVisibleMagazine = null;
  }

  try {
    const { start, end } = getPreviousWeekRange();

    let q = query(
      collection(db, `artifacts/${appId}/news`),
      where('weeklyMagazine', '==', true),
      where('scheduledAt', '>=', start),
      where('scheduledAt', '<=', end),
      orderBy('scheduledAt', 'desc'),
      limit(2)
    );

    if (loadMore && lastVisibleMagazine) {
      q = query(q, startAfter(lastVisibleMagazine));
    }

    const snap = await getDocs(q);
    if (!loadMore) weeklyMagazineGrid.innerHTML = '';

    if (snap.empty) {
      if (!loadMore) weeklyMagazineGrid.innerHTML = '<p class="text-gray-400">No weekly magazines available from last week.</p>';
      loadMoreMagazinesBtn.style.display = 'none';
      return;
    }

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const card = document.createElement('div');
      card.className = 'weekly-magazine-card';
      card.innerHTML = `
        <img src="${data.imageUrl}" alt="${data.title}" onerror="this.src='https://placehold.co/300x400/333/eee?text=No+Image'">
        <h4>${data.title}</h4>
        <p>${data.description?.slice(0, 100) || data.content?.slice(0, 100) || ''}...</p>
      `;
      card.addEventListener('click', () => {
        window.location.href = `weekly-magazine.html?id=${docSnap.id}&type=news`;
      });
      weeklyMagazineGrid.appendChild(card);
    });

    lastVisibleMagazine = snap.docs[snap.docs.length - 1];
    loadMoreMagazinesBtn.style.display = snap.size === 8 ? 'inline-block' : 'none';

  } catch (err) {
    console.error("Error loading weekly magazines:", err);
    weeklyMagazineGrid.innerHTML = '<p class="text-red-500">Failed to load weekly magazines.</p>';
    loadMoreMagazinesBtn.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadWeeklyMagazines();
  loadMoreMagazinesBtn?.addEventListener('click', () => loadWeeklyMagazines(true));
});