// ✅ FULLY UPDATED awards.js

import { db, auth, currentUser, currentUserId, isAuthReady } from './firebase-init.js';
import {
  collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, increment, runTransaction
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, showCustomModal, formatDate, formatDateTime } from './utils.js';
import { Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const industrySelector = document.getElementById('industry-selector');
const awardsCategoriesContainer = document.getElementById('awards-categories');
const noIndustrySelectedMsg = document.getElementById('no-industry-selected');
const noActiveVotingMsg = document.getElementById('no-active-voting');
let countdownTimers = {};

const clearAllTimers = () => {
  for (const categoryId in countdownTimers) clearInterval(countdownTimers[categoryId]);
  countdownTimers = {};
};

const loadAwardsCategories = async (industry) => {
  if (!awardsCategoriesContainer) return;

  clearAllTimers();
  awardsCategoriesContainer.innerHTML = '';
  noIndustrySelectedMsg.style.display = 'none';
  noActiveVotingMsg.style.display = 'none';

  if (!industry) {
    noIndustrySelectedMsg.style.display = 'block';
    return;
  }

  awardsCategoriesContainer.innerHTML = '<p class="loading-message">Loading awards categories...</p>';

  try {
    const q = query(collection(db, `artifacts/${appId}/categories`), where('industry', '==', industry));
    const querySnapshot = await getDocs(q);
    awardsCategoriesContainer.innerHTML = '';

    if (querySnapshot.empty) {
      noActiveVotingMsg.style.display = 'block';
      return;
    }

    // ✅ Sort categories alphabetically
    const categories = querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const now = Timestamp.now().toDate();
    let anyDisplayed = false;

    for (const category of categories) {
      const { id: categoryId, name, startTime, endTime } = category;
      const start = startTime?.toDate();
      const end = endTime?.toDate();

      const active = start && end && now >= start && now < end;
      const ended = end && now >= end;
      const upcoming = start && now < start;

      let statusText = '', statusClass = '', showNominees = false;
      if (active) [statusText, statusClass, showNominees] = [`Voting Live: `, 'voting-timer', true];
      else if (ended) [statusText, statusClass, showNominees] = ['Voting Ended', 'voting-ended', true];
      else if (upcoming) [statusText, statusClass] = [`Voting Starts: ${formatDateTime(startTime)}`, 'voting-upcoming'];
      else [statusText, statusClass] = ['No voting period set.', 'voting-inactive'];

      const block = document.createElement('div');
      block.classList.add('awards-category-block');
      block.innerHTML = `
        <h4>${name}</h4>
        <p class="${statusClass}" id="timer-${categoryId}">${statusText}</p>
        <div class="nominees-grid" id="nominees-grid-${categoryId}">
          ${showNominees ? '<p class="loading-message">Loading nominees...</p>' : '<p class="no-data-message">Nominees will be shown once voting starts.</p>'}
        </div>
      `;
      awardsCategoriesContainer.appendChild(block);

      if (active) {
        startCountdown(categoryId, end);
        displayNominees(categoryId, name, false);
        anyDisplayed = true;
      } else if (ended) {
        displayNominees(categoryId, name, true);
        anyDisplayed = true;
      }
    }

    if (!anyDisplayed) noActiveVotingMsg.style.display = 'block';

  } catch (error) {
    console.error("Error loading awards categories:", error);
    showToast('Failed to load awards categories.', 'error');
  }
};


const startCountdown = (categoryId, endTime) => {
  const el = document.getElementById(`timer-${categoryId}`);
  if (!el) return;

  const update = () => {
    const dist = endTime.getTime() - Date.now();
    if (dist < 0) {
      clearInterval(countdownTimers[categoryId]);
      el.textContent = 'Voting Ended';
      el.classList.remove('voting-timer');
      el.classList.add('voting-ended');

      const block = el.closest('.awards-category-block');
      const name = block?.querySelector('h4')?.textContent || 'Category';
      displayNominees(categoryId, name, true);
      return;
    }
    const d = Math.floor(dist / (1000 * 60 * 60 * 24));
    const h = Math.floor((dist % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((dist % (1000 * 60)) / 1000);
    el.textContent = `Voting Live: ${d}d ${h}h ${m}m ${s}s left`;
  };
  update();
  countdownTimers[categoryId] = setInterval(update, 1000);
};

const displayNominees = async (categoryId, categoryName, showResults = false) => {
  const container = document.getElementById(`nominees-grid-${categoryId}`);
  if (!container) return;
  container.innerHTML = '<p class="loading-message">Loading nominees...</p>';

  try {
    const q = query(collection(db, `artifacts/${appId}/nominees`), where('categoryId', '==', categoryId));
    const snapshot = await getDocs(q);
    container.innerHTML = '';
    if (snapshot.empty) {
      container.innerHTML = '<p class="no-data-message">No nominees found.</p>';
      return;
    }

    const nominees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    let userVote = null;
    if (currentUser && currentUserId) {
      const userVoteSnap = await getDoc(doc(db, `artifacts/${appId}/users/${currentUserId}/userVotes`, categoryId));
      if (userVoteSnap.exists()) userVote = userVoteSnap.data().nomineeId;
    }

    let winnerId = null;
    if (showResults) {
  let maxVotes = -1;
  nominees.forEach(n => {
    if ((n.votes || 0) > maxVotes) {
      maxVotes = n.votes;
      winnerId = n.id;
    }
  });

  // ✅ Create Winner Document with full details
  const winnerRef = doc(db, `artifacts/${appId}/winners`, categoryId);
  const winnerDoc = await getDoc(winnerRef);

  if (!winnerDoc.exists()) {
    const winnerNominee = nominees.find(n => n.id === winnerId);

    if (winnerNominee) {
      const winnerData = {
        year: new Date().getFullYear(),
        industry: industrySelector.value,
        categoryName: categoryName,
        celebrityId: winnerId,
        celebrityName: winnerNominee.name || 'Unknown',
        celebrityPhoto: winnerNominee.photoUrl || '',
        createdAt: Timestamp.now(),
      };
      await setDoc(winnerRef, winnerData);
    } else {
      console.warn("Winner nominee not found in nominee list.");
    }
  }
}
    nominees.forEach(nom => {
  const isWinner = nom.id === winnerId;
  const voted = userVote === nom.id;

  container.insertAdjacentHTML('beforeend', `
    <div class="nominee-card ${voted ? 'voted' : ''}">
      ${isWinner ? '<span class="nominee-winner">Winner!</span>' : ''}
      <a href="celebrity-details.html?celebrityId=${nom.celebrityId}" class="celebrity-link">
        <img src="${nom.photoUrl || 'https://placehold.co/180x180'}" alt="${nom.name}">
        <h5>${nom.name}</h5>
      </a>
      <p>
        ${nom.movieTitle && nom.movieId 
          ? `<a href="movie-details.html?movieId=${nom.movieId}" class="movie-link" target="_blank">${nom.movieTitle}</a>` 
          : (nom.movieTitle || 'No movie selected')}
      </p>
      ${!showResults ? `
        <button
          class="vote-button ${voted ? 'voted-style' : 'btn primary'}"
          data-nominee-id="${nom.id}"
          data-category-id="${categoryId}"
          ${voted ? 'disabled' : ''}>
          ${voted ? 'Voted' : 'Vote'}
        </button>
        <button class="share-button btn secondary" data-nominee-name="${nom.name}" data-category-name="${categoryName}">
          <i class="fas fa-share-alt"></i> Share
        </button>
      ` : ''}
    </div>
  `);
});


    if (!showResults) {
      container.querySelectorAll('.vote-button')?.forEach(btn => {
        btn.addEventListener('click', async (e) => {
          if (currentUser && currentUserId) {
            const nomineeId = e.target.dataset.nomineeId;
            const catId = e.target.dataset.categoryId;
            handleVote(catId, nomineeId);
          } else {
            showToast('Please login to vote.', 'info');
          }
        });
      });
    
    container.querySelectorAll('.share-button')?.forEach(btn => {
  btn.addEventListener('click', () => {
    const nomineeName = btn.dataset.nomineeName;
    const categoryName = btn.dataset.categoryName;
    shareNominee(nomineeName, categoryName);
  });
});
    }
  } catch (e) {
    console.error("Error displaying nominees:", e);
    container.innerHTML = '<p class="no-data-message">Failed to load nominees.</p>';
  }
};

const handleVote = async (categoryId, nomineeId) => {
  if (!currentUser || !currentUserId) return showToast('Login to vote.', 'error');

  const voteRef = doc(db, `artifacts/${appId}/users/${currentUserId}/userVotes`, categoryId);
  const nomineeRef = doc(db, `artifacts/${appId}/nominees`, nomineeId);

  const confirm = await new Promise(resolve => showCustomModal('Confirm your vote?', () => resolve(true), () => resolve(false)));
  if (!confirm) return;

  try {
    await runTransaction(db, async tx => {
      const voteSnap = await tx.get(voteRef);
      if (voteSnap.exists()) throw new Error('You already voted.');
      const nomSnap = await tx.get(nomineeRef);
      if (!nomSnap.exists()) throw new Error('Nominee missing.');
      const currentVotes = nomSnap.data().votes || 0;
      tx.update(nomineeRef, { votes: currentVotes + 1 });
      tx.set(voteRef, { nomineeId, userId: currentUserId, categoryId, votedAt: Timestamp.now() });
    });
    showToast('Vote submitted!', 'success');
    loadAwardsCategories(industrySelector.value);
  } catch (e) {
    showToast(`Vote failed: ${e.message}`, 'error');
  }
};

const shareNominee = (nominee, category) => {
  const text = `I just voted for ${nominee} in '${category}' at Movie Reporter! #Movie Reporter`;
  if (navigator.share) navigator.share({ title: 'Vote Movie Reporter', text, url: location.href }).catch(console.error);
  else window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.href)}`, '_blank');
};

document.addEventListener('DOMContentLoaded', () => {
  const checkAndLoad = () => {
    if (isAuthReady) {
      const industryParam = new URLSearchParams(location.search).get('industry');
      if (industryParam) industrySelector.value = industryParam;
      loadAwardsCategories(industrySelector.value);
      industrySelector?.addEventListener('change', e => loadAwardsCategories(e.target.value));
    } else {
      setTimeout(checkAndLoad, 100);
    }
  };
  checkAndLoad();
});

window.addEventListener('beforeunload', clearAllTimers);
