// js/news.js

import { db, auth, currentUser, currentUserId, isAuthReady } from './firebase-init.js';
import { collection, query, orderBy, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, where, setDoc, limit, startAfter, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, showCustomModal, formatDate, formatDateTime } from './utils.js';
import { Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Get app ID from global variable
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
console.log("App ID (from news.js):", appId); // Initial appId log

// DOM Elements
const newsListContainer = document.getElementById('news-list');
const articleDetailModal = document.getElementById('article-detail-modal');
const articleDetailDisplay = document.getElementById('article-detail-display');
const loadMoreNewsBtn = document.getElementById('load-more-news-btn');
const commentsList = document.getElementById('comments-list');
const commentForm = document.getElementById('comment-form');
const commentText = document.getElementById('comment-text');
const commentLoginPrompt = document.getElementById('comment-login-prompt');
const modalCloseButton = articleDetailModal?.querySelector('.close-button'); // Get the close button for the modal

let currentArticleId = null; // To keep track of the article currently open in the modal
let currentArticleType = 'news'; // 'news' or 'blog' for moderation purposes

// Pagination state for infinite scrolling
let lastVisibleNews = null;
let selectedCategory = ''; // Holds currently selected category for filtering
let isLoadingNews = false; // Flag to prevent multiple simultaneous loads
const NEWS_LOAD_LIMIT = 8; // Number of articles to load per batch

// Generic spinner HTML
const spinnerHtml = `
    <div class="spinner" style="text-align: center; padding: 20px;">
        <i class="fas fa-spinner fa-spin"></i> Loading more articles...
    </div>
`;

/**
 * Shows a loading spinner in the specified container.
 * @param {HTMLElement} container The DOM element to insert the spinner into.
 */
const showSpinner = (container) => {
    if (container) {
        container.insertAdjacentHTML('beforeend', spinnerHtml);
    }
};

/**
 * Removes the loading spinner from the specified container.
 * @param {HTMLElement} container The DOM element to remove the spinner from.
 */
const removeSpinner = (container) => {
    const existingSpinner = container?.querySelector('.spinner');
    if (existingSpinner) {
        existingSpinner.remove();
    }
};

/**
 * Loads and displays news articles with lazy loading/infinite scroll.
 * @param {boolean} loadMore - True if loading more, false for initial load.
 */
const loadNewsArticles = async (loadMore = false) => {
    console.log("loadNewsArticles called. Load more:", loadMore, "Selected Category:", selectedCategory);
    if (!newsListContainer || isLoadingNews) {
        console.log("Preventing loadNewsArticles: newsListContainer missing or already loading.");
        return;
    }

    isLoadingNews = true;

    if (!loadMore) {
        newsListContainer.innerHTML = '<p>Loading news articles...</p>';
        lastVisibleNews = null;
        loadMoreNewsBtn.style.display = 'none';
        console.log("Initial news load: Clearing container, hiding load more button.");
    } else {
        showSpinner(newsListContainer);
        console.log("Loading more news: Showing spinner.");
    }

    try {
        const newsRef = collection(db, `artifacts/${appId}/news`);
        const now = Timestamp.now();
        let q;

        if (selectedCategory) {
            console.log("Querying with category filter:", selectedCategory);
            if (lastVisibleNews && loadMore) {
                q = query(
                    newsRef,
                    where('scheduledAt', '<=', now),
                    where('category', '==', selectedCategory),
                    orderBy('scheduledAt', 'desc'),
                    startAfter(lastVisibleNews),
                    limit(NEWS_LOAD_LIMIT)
                );
            } else {
                q = query(
                    newsRef,
                    where('scheduledAt', '<=', now),
                    where('category', '==', selectedCategory),
                    orderBy('scheduledAt', 'desc'),
                    limit(NEWS_LOAD_LIMIT)
                );
            }
        } else {
            console.log("Querying without category filter.");
            if (lastVisibleNews && loadMore) {
                q = query(
                    newsRef,
                    where('scheduledAt', '<=', now),
                    orderBy('scheduledAt', 'desc'),
                    startAfter(lastVisibleNews),
                    limit(NEWS_LOAD_LIMIT)
                );
            } else {
                q = query(
                    newsRef,
                    where('scheduledAt', '<=', now),
                    orderBy('scheduledAt', 'desc'),
                    limit(NEWS_LOAD_LIMIT)
                );
            }
        }
        console.log("Firestore query built:", q);
        const querySnapshot = await getDocs(q);
        console.log("Query snapshot received. Number of docs:", querySnapshot.size);

        if (!loadMore) {
            newsListContainer.innerHTML = '';
        } else {
            removeSpinner(newsListContainer);
        }

        if (querySnapshot.empty && !loadMore) {
            newsListContainer.innerHTML = '<p class="no-data-message">No news articles available yet.</p>';
            loadMoreNewsBtn.style.display = 'none';
            console.log("No news articles found on initial load.");
            return;
        }

        if (querySnapshot.empty && loadMore) {
            showToast('No more news articles to load.', 'info');
            loadMoreNewsBtn.style.display = 'none';
            console.log("No more news articles to load.");
            return;
        }

        lastVisibleNews = querySnapshot.docs[querySnapshot.docs.length - 1];
        console.log("Last visible news for pagination:", lastVisibleNews?.id);

        querySnapshot.forEach((docSnap) => {
            const article = docSnap.data();
            const articleId = docSnap.id;
            // console.log("Rendering article:", articleId, article.title); // Too verbose, uncomment if needed
            const articleCard = `
                <div class="article-card" data-article-id="${articleId}" data-article-type="news">
                    <img src="${article.imageUrl || 'https://placehold.co/300x200/333/eee?text=No+Image'}" alt="${article.title}" onerror="this.onerror=null;this.src='https://placehold.co/300x200/333/eee?text=No+Image';">
                    <div class="article-card-info">
                        <h4>${article.title}</h4>
                        <p>${article.content.substring(0, 100)}...</p>
                        <p class="article-meta">By ${article.author || 'Anonymous'} on ${formatDate(article.scheduledAt || article.createdAt)}</p>
                        <button class="btn secondary view-more-btn" data-article-id="${articleId}" data-article-type="news">View More</button>
                    </div>
                </div>
            `;
            newsListContainer.insertAdjacentHTML('beforeend', articleCard);
        });

        // Add event listeners to cards
        newsListContainer.querySelectorAll('.article-card:not([data-listener-added])').forEach(card => {
            card.addEventListener('click', (event) => {
                const articleId = event.currentTarget.dataset.articleId;
                console.log("Article card clicked, opening modal for ID:", articleId);
                openNewsModalById(articleId);
            });
            card.setAttribute('data-listener-added', 'true');
        });

        newsListContainer.querySelectorAll('.view-more-btn:not([data-listener-added])').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click event from firing as well
                const articleId = e.currentTarget.dataset.articleId;
                console.log("View More button clicked, opening modal for ID:", articleId);
                openNewsModalById(articleId);
            });
            button.setAttribute('data-listener-added', 'true');
        });

        loadMoreNewsBtn.style.display = querySnapshot.size < NEWS_LOAD_LIMIT ? 'none' : 'inline-block';
        console.log("Load More button display set based on query size:", querySnapshot.size);

    } catch (error) {
        console.error("Error loading news articles:", error);
        showToast('Failed to load news articles. Please try again.', 'error');
        if (!loadMore) {
            newsListContainer.innerHTML = '<p class="no-data-message">Error loading articles.</p>';
        } else {
            removeSpinner(newsListContainer);
        }
        loadMoreNewsBtn.style.display = 'none';
    } finally {
        isLoadingNews = false;
        console.log("loadNewsArticles finished. isLoadingNews set to false.");
    }
};


/**
 * Displays the detailed view of a news article in a modal.
 * This function is exposed globally for use by main.js.
 * @param {string} articleId The ID of the article to display.
 */
export async function openNewsModalById(articleId) {
  console.log("openNewsModalById called for article ID:", articleId);
  currentArticleId = articleId;
  currentArticleType = 'news';

  if (!articleDetailDisplay || !articleDetailModal) {
    showToast("Error: Modal element missing.", "error");
    console.error("Modal elements not found!");
    return;
  }

  articleDetailDisplay.innerHTML = '<p>Loading article details...</p>';
  articleDetailModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  updateCommentSectionVisibility();

  try {
    const articleRef = doc(db, `artifacts/${appId}/news`, articleId);
    console.log("Article Ref path:", articleRef.path);
    const feedbackRef = currentUser ? doc(db, `artifacts/${appId}/news/${articleId}/feedback`, currentUserId) : null;
    console.log("Feedback Ref path (if user logged in):", feedbackRef ? feedbackRef.path : "N/A (user not logged in)");

    const [articleSnap, feedbackSnap] = await Promise.all([
      getDoc(articleRef),
      feedbackRef ? getDoc(feedbackRef) : Promise.resolve(null)
    ]);
    console.log("Article snapshot exists:", articleSnap.exists());
    console.log("Feedback snapshot exists:", feedbackSnap?.exists());

    if (!articleSnap.exists()) {
      articleDetailDisplay.innerHTML = '<p>Article not found.</p>';
      showToast('Article not found.', 'error');
      console.error("Article with ID", articleId, "not found in Firestore.");
      return;
    }

    const article = articleSnap.data();
    let currentFeedbackType = feedbackSnap?.exists() ? feedbackSnap.data().type : null;
    console.log("Initial currentFeedbackType loaded:", currentFeedbackType);

    const likes = article.likesCount || 0;
    const dislikes = article.dislikesCount || 0;
    console.log("Initial likes:", likes, "dislikes:", dislikes);

    articleDetailDisplay.innerHTML = `
  <h3>${article.title}</h3>
  <p class="article-meta">By ${article.author || 'Anonymous'} on ${formatDate(article.scheduledAt || article.createdAt)}</p>
  <img src="${article.imageUrl || 'https://placehold.co/800x400/333/eee?text=No+Image'}" alt="${article.title}">
  
  <div style="display: flex; align-items: center; gap: 10px; margin: 10px 0;">
    <button id="share-news-btn"><i class="fas fa-share-alt"></i></button>
  </div>

  <div class="like-dislike-container" style="margin: 20px 0; text-align: center;">
    <button id="like-button" class="btn ${currentFeedbackType === 'like' ? 'primary' : ''}">
      👍 Like <span id="like-count">${likes}</span>
    </button>
    <button id="dislike-button" class="btn ${currentFeedbackType === 'dislike' ? 'primary' : ''}">
      👎 Dislike <span id="dislike-count">${dislikes}</span>
    </button>
  </div>
  <h3>Summary</h3>
<p class="article-summary">${article.summary || ''}</p> <!-- NEW: summary -->
<h3>Content</h3>
  <div class="article-content-display">
    <p>${article.content.replace(/\n/g, '<br>')}</p>
  </div>
`;


    // Share handler
    document.getElementById('share-news-btn')?.addEventListener('click', async () => {
      const shareUrl = `${window.location.origin}/news.html?id=${articleId}&type=news`;
      console.log("Share button clicked. Share URL:", shareUrl);
      try {
        if (navigator.share) {
          await navigator.share({ title: article.title, text: article.content?.slice(0, 100), url: shareUrl });
          console.log("Article shared via Web Share API.");
        } else {
          await navigator.clipboard.writeText(shareUrl);
          showToast('Link copied to clipboard!', 'success');
          console.log("Article link copied to clipboard.");
        }
      } catch (err) {
        showToast('Could not share the article.', 'error');
        console.error("Error sharing article:", err);
      }
    });

    const likeBtn = document.getElementById('like-button');
    const dislikeBtn = document.getElementById('dislike-button');
    const likeCountSpan = document.getElementById('like-count');
    const dislikeCountSpan = document.getElementById('dislike-count');

    // This is the function where the "Missing or insufficient permissions" error usually occurs
    const updateFeedback = async (type) => {
      console.log("--- updateFeedback Called ---");
      console.log("Current User (from firebase-init):", currentUser?.uid);
      console.log("Current User ID (from firebase-init):", currentUserId);
      console.log("App ID (local var):", appId); // Confirming appId at this critical point
      console.log("Article ID (modal state):", articleId);
      console.log("Feedback Type being sent (new):", type);
      console.log("Current Feedback Type (local state):", currentFeedbackType); // What was it before this click?

      if (!currentUser) {
        showToast('Login to react.', 'warning');
        console.warn("Feedback update aborted: User not logged in.");
        return;
      }

      const newsRef = doc(db, `artifacts/${appId}/news`, articleId);
      // Path for the user's specific feedback document:
      const fbRef = doc(db, `artifacts/${appId}/news/${articleId}/feedback`, currentUserId);
      console.log("Firestore Path for newsRef:", newsRef.path);
      console.log("Firestore Path for fbRef (user's specific feedback):", fbRef.path);

      const updates = {};

      // Scenario 1: User is removing their existing reaction (clicking the same button again)
      if (currentFeedbackType === type) {
        console.log(`Action: User is removing their ${type} reaction.`);
        // Set THEIR feedback document type to null
        console.log("Attempting setDoc on fbRef with payload:", { type: null }, "and merge: true");
        try {
            await setDoc(fbRef, { type: null }, { merge: true });
            console.log("setDoc (remove feedback) successful on fbRef.");
        } catch (error) {
            console.error("Error during setDoc (remove feedback) on fbRef:", error);
            showToast('Failed to remove reaction. Permissions error?', 'error');
            return;
        }

        updates[`${type}sCount`] = increment(-1); // Decrement the main article's count
        console.log("Attempting updateDoc on newsRef with payload (decrement):", updates);
        try {
            await updateDoc(newsRef, updates);
            console.log("updateDoc (decrement count) successful on newsRef.");
        } catch (error) {
            console.error("Error during updateDoc (decrement count) on newsRef:", error);
            showToast('Failed to update reaction count. Permissions error?', 'error');
            return; // Stop execution if this critical update fails
        }

        // Client-side UI updates
        if (type === 'like') {
          likeBtn.classList.remove('primary');
          likeCountSpan.textContent = parseInt(likeCountSpan.textContent) - 1;
        } else {
          dislikeBtn.classList.remove('primary');
          dislikeCountSpan.textContent = parseInt(dislikeCountSpan.textContent) - 1;
        }
        currentFeedbackType = null; // Update local state
        console.log("UI updated for removal. New currentFeedbackType:", currentFeedbackType);
        showToast('Reaction removed!', 'info');
        return;
      }

      // Scenario 2: User is switching their reaction (e.g., from like to dislike, or vice-versa)
      // OR User is adding a brand new reaction (no currentFeedbackType)
      console.log(`Action: User is adding/switching to ${type} reaction.`);
      if (currentFeedbackType) {
        updates[`${currentFeedbackType}sCount`] = increment(-1); // Decrement old count if switching
        console.log(`Decremented old count for ${currentFeedbackType}.`);
      }
      updates[`${type}sCount`] = increment(1); // Increment new count
      console.log(`Incremented new count for ${type}.`);


      // Execute both updates in parallel
      console.log("Attempting Promise.all for setDoc on fbRef and updateDoc on newsRef.");
      console.log("setDoc payload (add/switch feedback):", { type });
      console.log("updateDoc payload (add/switch counts):", updates);
      try {
        await Promise.all([
          setDoc(fbRef, { type }, { merge: true }), // Update THEIR feedback document with the new type
          updateDoc(newsRef, updates) // Update the main article's counts
        ]);
        console.log("Promise.all (add/switch feedback and counts) successful.");
      } catch (error) {
        console.error("Error during Promise.all (add/switch feedback and counts):", error);
        showToast('Failed to update reaction. Permissions error?', 'error');
        return; // Stop execution if this critical update fails
      }


      // Client-side UI updates
      if (type === 'like') {
        likeBtn.classList.add('primary');
        dislikeBtn.classList.remove('primary'); // Remove 'primary' from other button if switching
        likeCountSpan.textContent = parseInt(likeCountSpan.textContent) + 1;
        if (currentFeedbackType === 'dislike') dislikeCountSpan.textContent = parseInt(dislikeCountSpan.textContent) - 1; // Decrement other if switching
      } else {
        dislikeBtn.classList.add('primary');
        likeBtn.classList.remove('primary'); // Remove 'primary' from other button if switching
        dislikeCountSpan.textContent = parseInt(dislikeCountSpan.textContent) + 1;
        if (currentFeedbackType === 'like') likeCountSpan.textContent = parseInt(likeCountSpan.textContent) - 1; // Decrement other if switching
      }

      currentFeedbackType = type; // Update local state
      console.log("UI updated for add/switch. New currentFeedbackType:", currentFeedbackType);
      showToast('Reaction updated!', 'success');
    };

    likeBtn?.addEventListener('click', () => updateFeedback('like'));
    dislikeBtn?.addEventListener('click', () => updateFeedback('dislike'));

    loadCommentsForArticle(articleId, 'news');

    // Update URL
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('id', articleId);
    url.searchParams.set('type', 'news');
    window.history.replaceState({}, '', url.toString());
    console.log("URL updated:", url.toString());

  } catch (error) {
    console.error("Error opening news modal:", error);
    showToast('Failed to open news.', 'error');
    articleDetailDisplay.innerHTML = '<p>Error loading news.</p>';
  }
}


/**
 * Loads and displays comments for a specific article.
 * @param {string} articleId The ID of the article.
 * @param {string} type The type of article ('news' or 'blog').
 */
const loadCommentsForArticle = async (articleId, type) => {
    console.log("loadCommentsForArticle called for article:", articleId, "type:", type);
    if (!commentsList) {
        console.warn("commentsList element not found.");
        return;
    }

    commentsList.innerHTML = '<p class="loading-message">Loading comments...</p>';

    try {
        const commentsRef = collection(db, `artifacts/${appId}/comments`);
        const q = query(
            commentsRef,
            where('articleId', '==', articleId),
            where('articleType', '==', type),
            orderBy('createdAt', 'asc')
        );
        console.log("Firestore query for comments built:", q);
        const querySnapshot = await getDocs(q);
        console.log("Comments query snapshot received. Number of comments:", querySnapshot.size);

        commentsList.innerHTML = '';

        if (querySnapshot.empty) {
            commentsList.innerHTML = '<p>No comments yet.</p>';
            console.log("No comments found for this article.");
            return;
        }

        const commentPromises = querySnapshot.docs.map(async (docSnap) => {
            const comment = docSnap.data();
            const commentId = docSnap.id;
            console.log("Processing comment ID:", commentId, "User ID:", comment.userId);

            // Fetch username from the user's UID document directly
            const userProfileRef = doc(db, `artifacts/${appId}/users`, comment.userId);
            const userProfileSnap = await getDoc(userProfileRef);
            const username = userProfileSnap.exists() ? userProfileSnap.data().username : 'Anonymous User';
            // console.log("Fetched username:", username); // Too verbose

            const date = formatDateTime(comment.createdAt);

            return `
                <div class="comment-card" data-comment-id="${commentId}">
                    <p class="comment-author">${username}</p>
                    <p class="comment-meta">${date}</p>
                    <p class="comment-text">${comment.commentText}</p>
                    ${currentUser && currentUser.uid === comment.userId ? `
                        <div class="comment-actions">
                            <button class="edit-comment-btn btn secondary btn-small" data-comment-id="${commentId}" data-comment-text="${comment.commentText}">Edit</button>
                            <button class="delete-comment-btn btn danger btn-small" data-comment-id="${commentId}">Delete</button>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        const commentCards = await Promise.all(commentPromises);
        commentCards.forEach(card => commentsList.insertAdjacentHTML('beforeend', card));
        console.log("All comment cards rendered.");

        // Add event listeners for edit/delete
        commentsList.querySelectorAll('.edit-comment-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const commentId = event.target.dataset.commentId;
                const text = event.target.dataset.commentText;
                console.log("Edit comment button clicked for ID:", commentId);
                editComment(commentId, text);
            });
        });
        commentsList.querySelectorAll('.delete-comment-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const commentId = event.target.dataset.commentId;
                console.log("Delete comment button clicked for ID:", commentId);
                confirmDeleteComment(commentId);
            });
        });

    } catch (error) {
        console.error("Error loading comments:", error);
        showToast('Failed to load comments.', 'error');
        commentsList.innerHTML = '<p>Error loading comments. Please try again.</p>';
    }
};

/**
 * Handles comment submission (add or edit).
 * @param {Event} event The form submission event.
 */
const handleCommentSubmit = async (event) => {
    event.preventDefault();
    console.log("handleCommentSubmit called.");

    if (!currentUser || !currentUserId) {
        showToast('You must be logged in to post a comment.', 'error');
        console.warn("Comment submission aborted: User not logged in.");
        return;
    }

    const commentContent = commentText.value.trim();
    if (commentContent === '') {
        showToast('Comment cannot be empty.', 'warning');
        console.warn("Comment submission aborted: Comment text is empty.");
        return;
    }

    try {
        const commentData = {
            articleId: currentArticleId,
            articleType: currentArticleType,
            userId: currentUserId,
            commentText: commentContent,
            createdAt: Timestamp.now(),
            approved: true // FIX: Comments are now automatically approved
        };
        console.log("Comment data prepared:", commentData);

        // Check if user has an existing comment on this article
        const existingCommentQuery = query(
            collection(db, `artifacts/${appId}/comments`),
            where('articleId', '==', currentArticleId),
            where('articleType', '==', currentArticleType),
            where('userId', '==', currentUserId)
        );
        console.log("Querying for existing user comment...");
        const existingCommentSnapshot = await getDocs(existingCommentQuery);
        console.log("Existing comment snapshot size:", existingCommentSnapshot.size);

        if (existingCommentSnapshot.empty) {
            // Add new comment
            console.log("No existing comment found. Adding new comment.");
            const docRef = await addDoc(collection(db, `artifacts/${appId}/comments`), commentData);
            console.log("New comment added to 'comments' collection with ID:", docRef.id);
            // Store a reference in user's private data
            const userCommentRef = doc(db, `artifacts/${appId}/users/${currentUserId}/userComments`, docRef.id);
            console.log("Adding reference to user's private comments:", userCommentRef.path);
            await setDoc(userCommentRef, {
                articleId: currentArticleId,
                articleType: currentArticleType,
                commentId: docRef.id,
                commentText: commentContent,
                createdAt: Timestamp.now(),
                approved: true
            });
            showToast('Comment posted successfully!', 'success');
            console.log("Comment reference added to user's private comments.");
        } else {
            // Update existing comment
            console.log("Existing comment found. Updating it.");
            const commentIdToUpdate = existingCommentSnapshot.docs[0].id;
            const commentDocRef = doc(db, `artifacts/${appId}/comments`, commentIdToUpdate);
            console.log("Updating main comment document:", commentDocRef.path);
            await updateDoc(commentDocRef, {
                commentText: commentContent,
                createdAt: Timestamp.now(), // Update timestamp on edit
                approved: true
            });
            // Update user's private reference
            const userCommentRef = doc(db, `artifacts/${appId}/users/${currentUserId}/userComments`, commentIdToUpdate);
            console.log("Updating user's private comment reference:", userCommentRef.path);
            await updateDoc(userCommentRef, {
                commentText: commentContent,
                createdAt: Timestamp.now(),
                approved: true
            });
            showToast('Comment updated successfully!', 'success');
            console.log("Comment updated in both main and private collections.");
        }

        commentText.value = ''; // Clear form
        loadCommentsForArticle(currentArticleId, currentArticleType); // Reload comments
        console.log("Comment form cleared and comments reloaded.");

    } catch (error) {
        console.error("Error submitting comment:", error);
        showToast(`Failed to submit comment: ${error.message}`, 'error');
    }
};

/**
 * Populates the comment form for editing.
 * @param {string} commentId The ID of the comment to edit.
 * @param {string} text The existing comment text.
 */
const editComment = (commentId, text) => {
    console.log("editComment called for ID:", commentId);
    commentText.value = text;
    commentText.focus();
    showToast('You can now edit your comment above.', 'info');
};

/**
 * Confirms and deletes a user's comment.
 * @param {string} commentId The ID of the comment to delete.
 */
const confirmDeleteComment = (commentId) => {
    console.log("confirmDeleteComment called for ID:", commentId);
    showCustomModal('Are you sure you want to delete this comment?', async () => {
        try {
            // Delete from public collection
            const mainCommentRef = doc(db, `artifacts/${appId}/comments`, commentId);
            console.log("Attempting to delete main comment:", mainCommentRef.path);
            await deleteDoc(mainCommentRef);
            console.log("Main comment deleted successfully.");
            // Delete from user's private collection
            const userCommentRef = doc(db, `artifacts/${appId}/users/${currentUserId}/userComments`, commentId);
            console.log("Attempting to delete user's private comment reference:", userCommentRef.path);
            await deleteDoc(userCommentRef);
            console.log("User's private comment reference deleted successfully.");

            showToast('Comment deleted successfully!', 'success');
            loadCommentsForArticle(currentArticleId, currentArticleType); // Reload comments
            console.log("Comments reloaded after deletion.");
        } catch (error) {
            console.error("Error deleting comment:", error);
            showToast(`Failed to delete comment: ${error.message}`, 'error');
        }
    });
};

/**
 * Updates the visibility of the comment form based on user authentication status.
 */
const updateCommentSectionVisibility = () => {
    console.log("updateCommentSectionVisibility called. Current user:", currentUser?.uid ? "Logged In" : "Logged Out");
    if (currentUser) {
        commentForm.classList.remove('comment-form-hidden');
        commentLoginPrompt.style.display = 'none';
        console.log("Comment form visible, login prompt hidden.");
    } else {
        commentForm.classList.add('comment-form-hidden');
        commentLoginPrompt.style.display = 'block';
        console.log("Comment form hidden, login prompt visible.");
    }
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded fired in news.js.");
    const checkAuthAndLoad = () => {
        if (isAuthReady) {
            console.log("Authentication ready. Initializing page elements and listeners.");
            // Category filter support
            const categoryFilter = document.getElementById('category-filter');
            categoryFilter?.addEventListener('change', () => {
                selectedCategory = categoryFilter.value;
                lastVisibleNews = null;
                console.log("Category filter changed to:", selectedCategory);
                loadNewsArticles(false);
            });

            // Initial article load
            loadNewsArticles(false);

            // Close modal when close button clicked
            modalCloseButton?.addEventListener('click', () => {
                articleDetailModal.style.display = 'none';
                document.body.style.overflow = 'auto';
                currentArticleId = null;
                currentArticleType = 'news';
                const url = new URL(window.location.href);
                url.searchParams.delete('id');
                url.searchParams.delete('type');
                window.history.replaceState({}, document.title, url.toString());
                console.log("Modal closed via close button. URL params cleared.");
            });

            // Close modal on outside click
            window.addEventListener('click', (event) => {
                if (event.target === articleDetailModal) {
                    articleDetailModal.style.display = 'none';
                    document.body.style.overflow = 'auto';
                    currentArticleId = null;
                    currentArticleType = 'news';
                    const url = new URL(window.location.href);
                    url.searchParams.delete('id');
                    url.searchParams.delete('type');
                    window.history.replaceState({}, document.title, url.toString());
                    console.log("Modal closed via outside click. URL params cleared.");
                }
            });

            // Comment submission
            commentForm?.addEventListener('submit', handleCommentSubmit);

            // Update comment visibility based on auth
            updateCommentSectionVisibility();

            auth.onAuthStateChanged((user) => {
                console.log("Auth state changed. User:", user ? user.uid : "No user");
                updateCommentSectionVisibility();
                if (articleDetailModal.style.display === 'flex' && currentArticleId) {
                    console.log("Modal open and article ID present, reloading comments due to auth change.");
                    loadCommentsForArticle(currentArticleId, currentArticleType);
                }
            });

            // Load more button
            const loadMoreNewsBtn = document.getElementById('load-more-news-btn');
            loadMoreNewsBtn?.addEventListener('click', () => {
                console.log("Load More News button clicked.");
                loadNewsArticles(true);
            });

            // Load specific article from URL if present
            const urlParams = new URLSearchParams(window.location.search);
            const articleIdFromUrl = urlParams.get('id');
            const articleTypeFromUrl = urlParams.get('type');
            if (articleIdFromUrl && articleTypeFromUrl === 'news') {
                console.log("Detected article ID in URL, opening modal:", articleIdFromUrl);
                openNewsModalById(articleIdFromUrl);
            }

            // Load initial category from URL (optional)
            const categoryFromUrl = urlParams.get('category');
            if (categoryFromUrl) {
                selectedCategory = categoryFromUrl;
                if (categoryFilter) categoryFilter.value = categoryFromUrl;
                console.log("Detected category in URL, setting filter:", categoryFromUrl);
                loadNewsArticles(false);
            }
        } else {
            console.log("Auth not ready yet, re-checking in 100ms...");
            setTimeout(checkAuthAndLoad, 100);
        }
    };

    checkAuthAndLoad();
});

// Expose globally
window.openNewsModalById = openNewsModalById;