// celebrity-details.js
import { db } from "./firebase-init.js";
import { doc, getDoc, collection, query, where, getDocs } 
from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const appId = typeof __app_id !== "undefined" ? __app_id : "default-app-id";

// ✅ Helper: Get query parameter
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

async function loadCelebrityDetails() {
  try {
    const celebrityId = getQueryParam("celebrityId");
    if (!celebrityId) {
      console.error("❌ No celebrityId found in URL.");
      return;
    }

    // ✅ Correct Firestore path for celebrity
    const celebrityRef = doc(db, "artifacts", appId, "celebrities", celebrityId);
    const celebritySnap = await getDoc(celebrityRef);

    if (!celebritySnap.exists()) {
      console.error("❌ Celebrity not found in Firestore.");
      const section = document.getElementById("celebrity-section");
      if (section) {
        section.innerHTML = "<p>❌ Celebrity not found.</p>";
      }
      return;
    }

    const celebrity = celebritySnap.data();

    // ✅ Fill details
    const nameEl = document.getElementById("celebrity-name");
    if (nameEl) nameEl.textContent = celebrity.name || "Unknown Celebrity";

    const roleEl = document.getElementById("celebrity-role");
    if (roleEl) roleEl.textContent = celebrity.role || "Unknown Role";

    const photoEl = document.getElementById("celebrity-photo");
    if (photoEl) {
      photoEl.src = celebrity.imageUrl || "https://placehold.co/180x180?text=No+Image";
      photoEl.alt = celebrity.name || "Celebrity Photo";
    }

    const descEl = document.getElementById("celebrity-description");
    if (descEl) {
      descEl.textContent = celebrity.description?.trim() || "No biography available.";
      descEl.style.whiteSpace = "pre-wrap"; // ✅ Preserve line breaks
    }

    // ✅ Load movies associated with this celebrity
    const moviesContainer = document.getElementById("celebrity-movies");
    if (moviesContainer) {
      moviesContainer.innerHTML = "<p>Loading movies...</p>";

      // Reference to `movies` subcollection inside this app
      const appDocRef = doc(db, "artifacts", appId);
      const moviesRef = collection(appDocRef, "movies");

      // Query for movies where castIds includes this celebrity
      const moviesQuery = query(moviesRef, where("castIds", "array-contains", celebrityId));
      const moviesSnap = await getDocs(moviesQuery);

      if (moviesSnap.empty) {
        moviesContainer.innerHTML = "<p>No movies found for this celebrity.</p>";
      } else {
        moviesContainer.innerHTML = "";
        moviesSnap.forEach((docSnap) => {
          const movie = docSnap.data();

          const card = document.createElement("div");
          card.className = "movie-card";
          card.onclick = () => {
            window.location.href = `movie-details.html?movieId=${docSnap.id}`;
          };

          card.innerHTML = `
            <img src="${movie.posterUrl || "https://placehold.co/200x300?text=No+Poster"}" 
                 alt="${movie.title || "Movie Poster"}">
            <h4>${movie.title || "Untitled Movie"}</h4>
          `;

          moviesContainer.appendChild(card);
        });
      }
    }
  } catch (error) {
    console.error("❌ Error loading celebrity:", error);
  }
}

// Run after DOM is ready
document.addEventListener("DOMContentLoaded", loadCelebrityDetails);
