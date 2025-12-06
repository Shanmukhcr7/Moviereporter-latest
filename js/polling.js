import { db, auth } from './firebase-init.js';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  setDoc,
  getDoc,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { showToast } from './utils.js';

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const livePollsContainer = document.getElementById('live-polls');

// --- Modal for custom answers ---
const customAnswersModal = document.createElement('div');
customAnswersModal.id = 'custom-answers-modal';
customAnswersModal.style.cssText = `
  position: fixed;
  top:0; left:0; right:0; bottom:0;
  background: rgba(0,0,0,0.5);
  display: none;
  justify-content: center;
  align-items: center;
  z-index: 10000;
`;
customAnswersModal.innerHTML = `
  <div class="modal-content bg-white p-6 rounded-lg shadow-lg max-w-lg w-full relative">
    <button id="close-custom-modal" style="position:absolute; top:10px; right:10px; font-size:20px;">&times;</button>
    <h3 class="text-xl font-semibold mb-4">Custom Answers</h3>
    <div id="custom-answers-list" class="space-y-2 max-h-96 overflow-y-auto"></div>
  </div>
`;
document.body.appendChild(customAnswersModal);

document.getElementById('close-custom-modal').addEventListener('click', () => {
  customAnswersModal.style.display = 'none';
});

async function loadLivePolls(user) {
  livePollsContainer.innerHTML = '<p class="text-gray-400">Loading polls...</p>';

  try {
    const now = Timestamp.now();
    const q = query(
      collection(db, `artifacts/${appId}/polls`),
      where('startTime', '<=', now),
      where('endTime', '>=', now),
      orderBy('startTime', 'desc')
    );

    const snap = await getDocs(q);
    livePollsContainer.innerHTML = '';

    if (snap.empty) {
      livePollsContainer.innerHTML = '<p class="text-gray-400 text-center py-8">No active polls right now. Please check back later!</p>';
      return;
    }

    for (const docSnap of snap.docs) {
      const poll = docSnap.data();
      const pollId = docSnap.id;
      const votesRef = collection(db, `artifacts/${appId}/polls/${pollId}/votes`);
      const votesSnap = await getDocs(votesRef);

      const voteCounts = {};
      (poll.options || []).forEach(opt => {
        const text = typeof opt === 'string' ? opt : opt.text;
        voteCounts[text] = 0;
      });

      let userVote = null;
      votesSnap.forEach(v => {
        const data = v.data();
        const text = data.selectedOption;
        voteCounts[text] = (voteCounts[text] || 0) + 1;
        if (user && data.userId === user.uid) userVote = text;
      });

      const section = document.createElement('section');
      section.className = 'bg-white shadow-md rounded-lg p-6 mb-6 poll-card';

      const renderPollContent = (currentVoteCounts, currentUserVote) => {
        const totalVotes = Object.values(currentVoteCounts).reduce((a, b) => a + b, 0);

        const generateOptionsHtml = (isVoted) => {
          return (poll.options || []).map(opt => {
            const text = typeof opt === 'string' ? opt : opt.text;
            const imageUrl = typeof opt === 'object' && opt.imageUrl ? opt.imageUrl : '';
            const percentage = totalVotes > 0 ? ((currentVoteCounts[text] || 0) / totalVotes * 100).toFixed(1) : 0;

            if (isVoted) {
              return `
                <div class="poll-option-result mb-2 flex items-center relative">
                  <div class="poll-option-bar bg-blue-200 h-10 rounded-lg" style="width: ${percentage}%;"></div>
                  <div class="poll-option-text absolute left-2 flex items-center text-gray-800 font-medium">
                    ${imageUrl ? `<img src="${imageUrl}" alt="${text}" class="h-10 w-10 mr-2 object-cover rounded-sm">` : ''}
                    <span>${text}</span>
                  </div>
                  <span class="poll-option-percentage absolute right-2 text-blue-800 font-semibold">${percentage}%</span>
                </div>
              `;
            } else {
              return `
                <div class="poll-option-group mb-2">
                  <label class="poll-option-label flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors duration-200">
                    <input type="radio" name="poll-${pollId}" value="${text}" class="mr-3 text-blue-600 focus:ring-blue-500" data-is-other="${opt.isOther ? 'true' : 'false'}" />
                    ${imageUrl ? `<img src="${imageUrl}" alt="${text}" class="h-10 w-10 mr-3 object-cover rounded-md">` : ''}
                    <span class="text-gray-800 font-medium">${text}</span>
                  </label>
                  ${opt.isOther ? `<input type="text" class="other-input hidden mt-2 w-full p-2 border border-gray-300 rounded-lg" placeholder="Type your answer..." />` : ''}
                </div>
              `;
            }
          }).join('');
        };

        const formId = `poll-form-${pollId}`;
        const resultDivId = `poll-result-${pollId}`;

        section.innerHTML = `
          <h3 class="text-xl font-semibold mb-4 text-gray-900">${poll.question}</h3>
          <div id="${formId}-container">
            ${user && currentUserVote ? `
              <div id="${resultDivId}" class="poll-results-container">
                ${generateOptionsHtml(true)}
                <p class="text-sm text-gray-500 mt-4 text-right">${totalVotes} vote(s) total</p>
              </div>
              <button type="button" class="btn primary mt-4 w-full" data-action="change-vote">Change Vote</button>
            ` : `
              <form id="${formId}" class="poll-voting-form">
                ${generateOptionsHtml(false)}
                <button type="submit" class="btn primary mt-4 w-full">Submit Vote</button>
              </form>
            `}
            ${(poll.options || []).some(o => o.isOther) ? `
              <button type="button" class="show-other-btn btn secondary w-full mt-4">Show Custom Answers</button>
            ` : ''}
          </div>
        `;

        livePollsContainer.appendChild(section);

        const formContainer = section.querySelector(`#${formId}-container`);

        // Voting form setup
        const setupFormListener = () => {
          const form = section.querySelector(`#${formId}`);
          if (!form) return;

          form.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', () => {
              form.querySelectorAll('.other-input').forEach(i => i.classList.add('hidden'));
              if (radio.dataset.isOther === 'true' && radio.checked) {
                radio.closest('.poll-option-group').querySelector('.other-input').classList.remove('hidden');
              }
            });
          });

          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!user) {
              showToast('You must be logged in to vote.', 'warning');
              return;
            }

            const selected = form.querySelector('input[type="radio"]:checked');
            if (!selected) {
              showToast('Please select an option.', 'warning');
              return;
            }

            let customText = '';
            const selectedOption = selected.value;
            if (selected.dataset.isOther === 'true') {
              const inputField = form.querySelector('.other-input:not(.hidden)');
              customText = inputField?.value.trim() || '';
              if (!customText) {
                showToast('Please enter your custom answer.', 'warning');
                return;
              }
            }

            try {
              const voteDocRef = doc(db, `artifacts/${appId}/polls/${pollId}/votes`, user.uid);
              await setDoc(voteDocRef, {
                userId: user.uid,
                selectedOption,
                customText,
                updatedAt: Timestamp.now()
              }, { merge: true });

              if (userVote && voteCounts[userVote] > 0) voteCounts[userVote]--;
              voteCounts[selectedOption] = (voteCounts[selectedOption] || 0) + 1;
              userVote = selectedOption;

              showToast('Your vote has been recorded!', 'success');
              renderPollContent(voteCounts, userVote);
            } catch (err) {
              console.error(err);
              showToast('Failed to submit your vote. Try again.', 'error');
            }
          });
        };

        if (!currentUserVote || !user) setupFormListener();

        // Change vote button
        if (user && currentUserVote) {
          const changeVoteButton = section.querySelector('[data-action="change-vote"]');
          changeVoteButton.addEventListener('click', () => {
            renderPollContent(voteCounts, null);
          });
        }

        // Show Custom Answers modal
        const showOtherBtn = section.querySelector('.show-other-btn');
        if (showOtherBtn) {
          showOtherBtn.addEventListener('click', async () => {
  const answersListDiv = document.getElementById('custom-answers-list');
  answersListDiv.innerHTML = '<p class="text-gray-500">Loading...</p>';
  customAnswersModal.style.display = 'flex';

  try {
    const votesSnapUpdated = await getDocs(collection(db, `artifacts/${appId}/polls/${pollId}/votes`));
    const otherAnswers = [];
    for (const v of votesSnapUpdated.docs) {
      const data = v.data();
      if (data.selectedOption === 'Other' && data.customText) {
        let username = 'Anonymous';
        try {
          const userDocRef = doc(db, `artifacts/${appId}/users`, data.userId);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            username = userDoc.data().username || data.userId; // fallback to UID
          } else {
            username = data.userId; // fallback if no doc
          }
        } catch (err) {
          console.warn("Failed to fetch username:", err);
          username = data.userId; // fallback
        }

        otherAnswers.push({
          text: data.customText,
          userId: data.userId,
          username,
          time: data.updatedAt ? data.updatedAt.toDate().toLocaleString() : 'Unknown'
        });
      }
    }

    if (otherAnswers.length === 0) {
      answersListDiv.innerHTML = '<p class="text-gray-500">No custom answers submitted yet.</p>';
      return;
    }

    answersListDiv.innerHTML = otherAnswers.map(ans => `
      <div class="flex justify-between items-center p-2 border-b border-gray-200">
        <div>
          <p class="font-medium text-gray-800">${ans.text}</p>
          <p class="text-sm text-gray-500">${ans.username} - ${ans.time}</p>
        </div>
        ${user && ans.userId === user.uid ? `
          <div class="flex gap-2">
            <button class="edit-other-btn text-blue-600 text-sm" data-user="${ans.userId}">Edit</button>
            <button class="delete-other-btn text-red-600 text-sm" data-user="${ans.userId}">Delete</button>
          </div>` : ''}
      </div>
    `).join('');

    // … keep your edit/delete listeners here …

  } catch (err) {
    console.error(err);
    answersListDiv.innerHTML = '<p class="text-red-500">Failed to load answers.</p>';
  }
});

        }
      };

      renderPollContent(voteCounts, userVote);
    }

  } catch (err) {
    console.error('Error loading polls:', err);
    livePollsContainer.innerHTML = '<p class="text-red-500 text-center py-8">Failed to load polls. Please try again later.</p>';
  }
}

// --- Auth listener ---
onAuthStateChanged(auth, (u) => {
  loadLivePolls(u);
});
