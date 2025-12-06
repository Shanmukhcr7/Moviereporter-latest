// js/blogs.js

import { db, auth, currentUser, currentUserId, isAuthReady } from './firebase-init.js';
import { collection, query, orderBy, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, where, setDoc, limit, startAfter,increment,serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, showCustomModal, formatDate, formatDateTime } from './utils.js';
import { Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Get app ID from global variable
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// DOM Elements
const blogsListContainer = document.getElementById('blogs-list');
const articleDetailModal = document.getElementById('article-detail-modal'); // Reusing modal from news
const articleDetailDisplay = document.getElementById('article-detail-display'); // Reusing from news
const loadMoreBlogsBtn = document.getElementById('load-more-blogs-btn');
const commentsList = document.getElementById('comments-list'); // Reusing from news
const commentForm = document.getElementById('comment-form'); // Reusing from news
const commentText = document.getElementById('comment-text'); // Reusing from news
const commentLoginPrompt = document.getElementById('comment-login-prompt'); // Reusing from news
const modalCloseButton = articleDetailModal?.querySelector('.close-button'); // Get the close button for the modal

let currentArticleId = null;
let currentArticleType = 'blog'; // This file specifically handles 'blog' type

// Pagination state for infinite scrolling
let lastVisibleBlog = null;
let isLoadingBlogs = false; // Flag to prevent multiple simultaneous loads
const BLOGS_LOAD_LIMIT = 8; // Number of articles to load per batch

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
 * Loads and displays blog articles with lazy loading/infinite scroll.
 * @param {boolean} loadMore - True if loading more, false for initial load.
 */
const loadBlogArticles = async (loadMore = false) => {
    if (!blogsListContainer || isLoadingBlogs) return;

    isLoadingBlogs = true;

    if (!loadMore) {
        blogsListContainer.innerHTML = '<p>Loading blog articles...</p>';
        lastVisibleBlog = null;
        if (loadMoreBlogsBtn) loadMoreBlogsBtn.style.display = 'none'; // Hide initially
    }

    try {
        const blogsRef = collection(db, `artifacts/${appId}/blogs`);
        const now = Timestamp.now();
        let q;

        if (lastVisibleBlog && loadMore) {
            q = query(blogsRef, where('scheduledAt', '<=', now), orderBy('scheduledAt', 'desc'), startAfter(lastVisibleBlog), limit(BLOGS_LOAD_LIMIT));
        } else {
            q = query(blogsRef, where('scheduledAt', '<=', now), orderBy('scheduledAt', 'desc'), limit(BLOGS_LOAD_LIMIT));
        }

        const querySnapshot = await getDocs(q);

        if (!loadMore) {
            blogsListContainer.innerHTML = ''; // Clear initial message
        }

        if (querySnapshot.empty) {
            if (!loadMore) {
                blogsListContainer.innerHTML = '<p class="no-data-message">No blog articles available yet.</p>';
            } else {
                showToast('No more blogs to load.', 'info');
            }
            if (loadMoreBlogsBtn) loadMoreBlogsBtn.style.display = 'none'; // Hide if no more
            return;
        }

        // Update pagination
        lastVisibleBlog = querySnapshot.docs[querySnapshot.docs.length - 1];

        // Append new articles
       // Append new articles
querySnapshot.forEach((docSnap) => {
    const article = docSnap.data();
    const articleId = docSnap.id;

    const articleCard = `
<div class="article-card" data-article-id="${articleId}" data-article-type="blog">
    <div class="article-image-wrapper" style="position: relative;">
        <img src="${article.imageUrl || 'https://placehold.co/300x200/333/eee?text=No+Image'}" 
             alt="${article.title}" 
             onerror="this.onerror=null;this.src='https://placehold.co/300x200/333/eee?text=No+Image';" 
             style="width:100%; display:block; border-radius:6px;">
        <button class="btn save-blog-btn secondary" data-blog-id="${articleId}" 
                style="
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: rgba(0,0,0,0.6);
                    border: none;
                    color: white;
                    padding: 6px 8px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 1em;
                ">
            <i class="fa-solid fa-compact-disc"></i> Save
        </button>
    </div>
    <div class="article-card-info">
        <h4>${article.title}</h4>
        <p>${article.content.substring(0, 100)}...</p>
        <p class="article-meta">By ${article.author || 'Anonymous'} on ${formatDate(article.scheduledAt || article.createdAt)}</p>
        <button class="btn secondary view-more-btn" data-article-id="${articleId}" data-article-type="blog">View More</button>
    </div>
</div>
`;

    blogsListContainer.insertAdjacentHTML('beforeend', articleCard);
});

// After appending cards: attach save button listeners
if (currentUser) {
    blogsListContainer.querySelectorAll('.save-blog-btn').forEach(async (button) => {
        if (button.dataset.listenerAdded) return; // avoid duplicates
        button.dataset.listenerAdded = 'true';

        const blogId = button.dataset.blogId;
        const savedSnap = await getDoc(doc(db, `artifacts/${appId}/users/${currentUser.uid}/savedBlogs`, blogId));
        const isSaved = savedSnap.exists();
        button.classList.toggle('primary', isSaved);
        button.classList.toggle('secondary', !isSaved);
        button.innerHTML = `<i class="fa-solid fa-compact-disc"></i> ${isSaved ? 'Saved' : 'Save'}`;

        button.addEventListener('click', async (e) => {
            e.stopPropagation(); // prevent opening modal
            await toggleSaveBlog(blogId, button);
        });
    });
}



        // Add click handlers
        blogsListContainer.querySelectorAll('.article-card:not([data-listener-added])').forEach(card => {
            card.addEventListener('click', (event) => {
                const articleId = event.currentTarget.dataset.articleId;
                openBlogModalById(articleId);
            });
            card.setAttribute('data-listener-added', 'true');
        });

        blogsListContainer.querySelectorAll('.view-more-btn:not([data-listener-added])').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const articleId = e.currentTarget.dataset.articleId;
                openBlogModalById(articleId);
            });
            button.setAttribute('data-listener-added', 'true');
        });

        // Show Load More button if more blogs can be loaded
        if (loadMoreBlogsBtn) loadMoreBlogsBtn.style.display = 'inline-block';

    } catch (error) {
        console.error("Error loading blog articles:", error);
        showToast('Failed to load blog articles. Please try again.', 'error');
        blogsListContainer.innerHTML = '<p class="no-data-message">Error loading articles.</p>';
    } finally {
        isLoadingBlogs = false;
    }
};



/**
 * Opens a blog modal and displays the blog details.
 * @param {string} articleId 
 */
export async function openBlogModalById(articleId) {
  currentArticleId = articleId;
  currentArticleType = 'blog';

  if (!articleDetailDisplay || !articleDetailModal) {
    console.error("Blog modal elements not found.");
    showToast("Error: Blog modal elements missing.", "error");
    return;
  }

  // Show loading state
  articleDetailDisplay.innerHTML = '<p class="loading-message">Loading article details...</p>';
  articleDetailModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  updateCommentSectionVisibility();

  try {
    const articleDocRef = doc(db, `artifacts/${appId}/blogs`, articleId);
    const articleSnap = await getDoc(articleDocRef);

    if (!articleSnap.exists()) {
      articleDetailDisplay.innerHTML = '<p class="no-data-message">Article not found.</p>';
      showToast('Article not found.', 'error');
      return;
    }

    const article = articleSnap.data();

    // Check if current user has saved this blog
    let isSaved = false;
    if (auth.currentUser) {
      const savedSnap = await getDoc(
        doc(db, `artifacts/${appId}/users/${auth.currentUser.uid}/savedBlogs`, articleId)
      );
      isSaved = savedSnap.exists();
    }

    // Get current user feedback (like/dislike)
    let currentFeedbackType = null;
    if (auth.currentUser) {
      const feedbackSnap = await getDoc(
        doc(db, `artifacts/${appId}/blogs/${articleId}/feedback`, auth.currentUser.uid)
      );
      currentFeedbackType = feedbackSnap.exists() ? feedbackSnap.data().type : null;
    }

    // Fill modal HTML
    articleDetailDisplay.innerHTML = `
      <h3>${article.title || 'Untitled'}</h3>
      <p class="article-meta">By ${article.author || 'Anonymous'} on ${formatDate(article.scheduledAt || article.createdAt)}</p>
      <img src="${article.imageUrl || 'https://placehold.co/800x400/333/eee?text=No+Image'}"
           alt="${article.title || 'Blog Image'}"
           onerror="this.onerror=null;this.src='https://placehold.co/800x400/333/eee?text=No+Image';">

      <div style="display:flex; gap:10px; margin:10px 0;">
        <button id="share-blog-btn" style="background:none; border:none; cursor:pointer; font-size:1.2em; color:var(--primary-color)">
          <i class="fas fa-share-alt"></i> Share
        </button>

        <button id="save-blog-btn" class="btn ${isSaved ? 'primary' : 'secondary'}">
          <i class="fa-solid fa-compact-disc"></i> ${isSaved ? 'Saved' : 'Save'}
        </button>
      </div>

      <div class="feedback-buttons" style="display:flex; gap:10px; align-items:center; margin:10px 0;">
        <button id="like-button" class="btn ${currentFeedbackType === 'like' ? 'primary' : 'secondary'}">
          👍 <span id="like-count">${article.likesCount || 0}</span>
        </button>
        <button id="dislike-button" class="btn ${currentFeedbackType === 'dislike' ? 'primary' : 'secondary'}">
          👎 <span id="dislike-count">${article.dislikesCount || 0}</span>
        </button>
      </div>

      <div id="blog-content" style="margin-top:15px;">${article.content || ''}</div>

      <div id="comments-section"></div>
    `;

    // Save / Unsave blog
    document.getElementById('save-blog-btn').addEventListener('click', async () => {
      const button = document.getElementById('save-blog-btn');
      if (!auth.currentUser) return showToast('Login to save blogs.', 'warning');

      const userSavedRef = doc(db, `artifacts/${appId}/users/${auth.currentUser.uid}/savedBlogs`, articleId);
      if (isSaved) {
        await deleteDoc(userSavedRef);
        button.classList.replace('primary', 'secondary');
        button.innerHTML = `<i class="fa-solid fa-compact-disc"></i> Save`;
        isSaved = false;
      } else {
        await setDoc(userSavedRef, { savedAt: serverTimestamp() });
        button.classList.replace('secondary', 'primary');
        button.innerHTML = `<i class="fa-solid fa-compact-disc"></i> Saved`;
        isSaved = true;
      }
    });

    // Share blog
    document.getElementById('share-blog-btn').addEventListener('click', async () => {
      const shareUrl = `${window.location.origin}/blogs.html?id=${articleId}&type=blog`;
      try {
        if (navigator.share) {
          await navigator.share({ title: article.title, text: article.content?.substring(0, 100), url: shareUrl });
        } else {
          await navigator.clipboard.writeText(shareUrl);
          showToast('Link copied to clipboard!', 'success');
        }
      } catch (err) {
        console.error('Share failed:', err);
        showToast('Could not share the article.', 'error');
      }
    });

    // Like / Dislike
    const likeBtn = document.getElementById('like-button');
    const dislikeBtn = document.getElementById('dislike-button');
    const likeCountSpan = document.getElementById('like-count');
    const dislikeCountSpan = document.getElementById('dislike-count');

    const updateFeedback = async (type) => {
      if (!auth.currentUser) return showToast('Login to react to this article.', 'warning');

      const blogRef = doc(db, `artifacts/${appId}/blogs`, articleId);
      const feedbackRef = doc(db, `artifacts/${appId}/blogs/${articleId}/feedback`, auth.currentUser.uid);

      if (currentFeedbackType === type) {
        // Toggle off
        await Promise.all([
          deleteDoc(feedbackRef),
          updateDoc(blogRef, { [`${type}sCount`]: increment(-1) })
        ]);

        if (type === 'like') {
          likeBtn.classList.replace('primary', 'secondary');
          likeCountSpan.textContent = Math.max(0, likeCountSpan.textContent - 1);
        } else {
          dislikeBtn.classList.replace('primary', 'secondary');
          dislikeCountSpan.textContent = Math.max(0, dislikeCountSpan.textContent - 1);
        }

        currentFeedbackType = null;
      } else {
        const updates = {};
        if (currentFeedbackType) updates[`${currentFeedbackType}sCount`] = increment(-1);
        updates[`${type}sCount`] = increment(1);

        await Promise.all([
          setDoc(feedbackRef, { type, timestamp: serverTimestamp() }, { merge: true }),
          updateDoc(blogRef, updates)
        ]);

        if (type === 'like') {
          likeBtn.classList.replace('secondary', 'primary');
          dislikeBtn.classList.replace('primary', 'secondary');
          likeCountSpan.textContent = parseInt(likeCountSpan.textContent) + 1;
          if (currentFeedbackType === 'dislike') dislikeCountSpan.textContent = Math.max(0, parseInt(dislikeCountSpan.textContent) - 1);
        } else {
          dislikeBtn.classList.replace('secondary', 'primary');
          likeBtn.classList.replace('primary', 'secondary');
          dislikeCountSpan.textContent = parseInt(dislikeCountSpan.textContent) + 1;
          if (currentFeedbackType === 'like') likeCountSpan.textContent = Math.max(0, parseInt(likeCountSpan.textContent) - 1);
        }

        currentFeedbackType = type;
      }
    };

    likeBtn.addEventListener('click', () => updateFeedback('like'));
    dislikeBtn.addEventListener('click', () => updateFeedback('dislike'));

    // Load comments
    loadCommentsForArticle(articleId, 'blog');

    // Update URL
    const newUrl = new URL(window.location.origin + window.location.pathname);
    newUrl.searchParams.set('id', articleId);
    newUrl.searchParams.set('type', 'blog');
    window.history.pushState({ path: newUrl.href }, '', newUrl.href);

  } catch (error) {
    console.error("Error showing blog detail:", error);
    articleDetailDisplay.innerHTML = '<p class="no-data-message">Error loading blog. Please try again.</p>';
    showToast('Failed to load blog details.', 'error');
  }
}


// Check if blog is saved by current user
const checkIfBlogSaved = async (blogId) => {
  if (!currentUser) return false;
  const docSnap = await getDoc(doc(db, `artifacts/${appId}/users/${currentUser.uid}/savedBlogs`, blogId));
  return docSnap.exists();
};

// Toggle saving a blog
const toggleSaveBlog = async (blogId, buttonElement) => {
  if (!currentUser) return showToast('Login to save blogs.', 'warning');

  const blogRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/savedBlogs`, blogId);
  const isSaved = await checkIfBlogSaved(blogId);

  if (isSaved) {
      await deleteDoc(blogRef);
      buttonElement.classList.remove('primary');
      buttonElement.classList.add('secondary');
      buttonElement.innerHTML = '<i class="fa-solid fa-compact-disc"></i> Save';
      showToast('Blog removed from saved.', 'info');
  } else {
      await setDoc(blogRef, { blogId, savedAt: Timestamp.now() });
      buttonElement.classList.remove('secondary');
      buttonElement.classList.add('primary');
      buttonElement.innerHTML = '<i class="fa-solid fa-compact-disc"></i> Saved';
      showToast('Blog saved!', 'success');
  }
};

/**
 * Loads and displays comments for a specific article.
 * @param {string} articleId The ID of the article.
 * @param {string} type The type of article ('news' or 'blog').
 */
const loadCommentsForArticle = async (articleId, type) => {
    if (!commentsList) return;

    commentsList.innerHTML = '<p class="loading-message">Loading comments...</p>';

    try {
        const commentsRef = collection(db, `artifacts/${appId}/comments`);
        const q = query(
            commentsRef,
            where('articleId', '==', articleId),
            where('articleType', '==', type),
            orderBy('createdAt', 'asc')
        );
        const querySnapshot = await getDocs(q);

        commentsList.innerHTML = '';

        if (querySnapshot.empty) {
            commentsList.innerHTML = '<p>No comments yet.</p>';
            return;
        }

        const commentPromises = querySnapshot.docs.map(async (docSnap) => {
            const comment = docSnap.data();
            const commentId = docSnap.id;

            // Fetch username from the user's UID document directly
            const userProfileRef = doc(db, `artifacts/${appId}/users`, comment.userId);
            const userProfileSnap = await getDoc(userProfileRef);
            const username = userProfileSnap.exists() ? userProfileSnap.data().username : 'Anonymous User';

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

        // Add event listeners for edit/delete
        commentsList.querySelectorAll('.edit-comment-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const commentId = event.target.dataset.commentId;
                const text = event.target.dataset.commentText;
                editComment(commentId, text);
            });
        });
        commentsList.querySelectorAll('.delete-comment-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const commentId = event.target.dataset.commentId;
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

    if (!currentUser || !currentUserId) {
        showToast('You must be logged in to post a comment.', 'error');
        return;
    }

    const commentContent = commentText.value.trim();
    if (commentContent === '') {
        showToast('Comment cannot be empty.', 'warning');
        return;
    }

    try {
        const commentData = {
            articleId: currentArticleId,
            articleType: currentArticleType, // 'blog'
            userId: currentUserId,
            commentText: commentContent,
            createdAt: Timestamp.now(),
            approved: true
        };

        const existingCommentQuery = query(
            collection(db, `artifacts/${appId}/comments`),
            where('articleId', '==', currentArticleId),
            where('articleType', '==', currentArticleType),
            where('userId', '==', currentUserId)
        );
        const existingCommentSnapshot = await getDocs(existingCommentQuery);

        if (existingCommentSnapshot.empty) {
            const docRef = await addDoc(collection(db, `artifacts/${appId}/comments`), commentData);
            await setDoc(doc(db, `artifacts/${appId}/users/${currentUserId}/userComments`, docRef.id), {
                articleId: currentArticleId,
                articleType: currentArticleType,
                commentId: docRef.id,
                commentText: commentContent,
                createdAt: Timestamp.now(),
                approved: true
            });
            showToast('Comment posted successfully!', 'success');
        } else {
            const commentIdToUpdate = existingCommentSnapshot.docs[0].id;
            const commentDocRef = doc(db, `artifacts/${appId}/comments`, commentIdToUpdate);
            await updateDoc(commentDocRef, {
                commentText: commentContent,
                createdAt: Timestamp.now(),
                approved: true
            });
            await updateDoc(doc(db, `artifacts/${appId}/users/${currentUserId}/userComments`, commentIdToUpdate), {
                commentText: commentContent,
                createdAt: Timestamp.now(),
                approved: true
            });
            showToast('Comment updated successfully!', 'success');
        }

        commentText.value = '';
        loadCommentsForArticle(currentArticleId, currentArticleType);

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
    commentText.value = text;
    commentText.focus();
    showToast('You can now edit your comment above.', 'info');
};

/**
 * Confirms and deletes a user's comment.
 * @param {string} commentId The ID of the comment to delete.
 */
const confirmDeleteComment = (commentId) => {
    showCustomModal('Are you sure you want to delete this comment?', async () => {
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/comments`, commentId));
            await deleteDoc(doc(db, `artifacts/${appId}/users/${currentUserId}/userComments`, commentId));
            showToast('Comment deleted successfully!', 'success');
            loadCommentsForArticle(currentArticleId, currentArticleType);
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
    if (currentUser) {
        commentForm.classList.remove('comment-form-hidden');
        commentLoginPrompt.style.display = 'none';
    } else {
        commentForm.classList.add('comment-form-hidden');
        commentLoginPrompt.style.display = 'block';
    }
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const checkAuthAndLoad = () => {
        if (isAuthReady) {
            loadBlogArticles(); // Initial load

            // Close modal functionality
            modalCloseButton?.addEventListener('click', () => {
                articleDetailModal.style.display = 'none';
                document.body.style.overflow = 'auto';
                currentArticleId = null;
                currentArticleType = 'blog';

                const url = new URL(window.location.href);
                url.searchParams.delete('id');
                url.searchParams.delete('type');
                window.history.replaceState({}, document.title, url.toString());
            });

            window.addEventListener('click', (event) => {
                if (event.target === articleDetailModal) {
                    articleDetailModal.style.display = 'none';
                    document.body.style.overflow = 'auto';
                    currentArticleId = null;
                    currentArticleType = 'blog';

                    const url = new URL(window.location.href);
                    url.searchParams.delete('id');
                    url.searchParams.delete('type');
                    window.history.replaceState({}, document.title, url.toString());
                }
            });

            commentForm?.addEventListener('submit', handleCommentSubmit);

            updateCommentSectionVisibility();

            auth.onAuthStateChanged(() => {
                updateCommentSectionVisibility();
                if (articleDetailModal.style.display === 'flex' && currentArticleId) {
                    loadCommentsForArticle(currentArticleId, currentArticleType);
                }
            });

            // ✅ Replacing infinite scroll with button click
            const loadMoreBlogsBtn = document.getElementById('load-more-blogs-btn');
            loadMoreBlogsBtn?.addEventListener('click', () => {
                loadBlogArticles(true);
            });

            // Deep link support
            const urlParams = new URLSearchParams(window.location.search);
            const articleIdFromUrl = urlParams.get('id');
            const articleTypeFromUrl = urlParams.get('type');

            if (articleIdFromUrl && articleTypeFromUrl === 'blog') {
                openBlogModalById(articleIdFromUrl);
            }
        } else {
            setTimeout(checkAuthAndLoad, 100);
        }
    };

    checkAuthAndLoad();
});

// Make the function globally accessible
window.openBlogModalById = openBlogModalById;
