// js/forgot-password.js
import { auth } from './firebase-init.js';
import { sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { showToast } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('reset-email');
  const form = document.getElementById('forgot-password-form');

  // ✅ Prefill email if passed via query param (?email=...)
  const params = new URLSearchParams(window.location.search);
  const prefillEmail = params.get('email');
  if (prefillEmail) {
    emailInput.value = decodeURIComponent(prefillEmail);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();

    if (!email) {
      showToast('Please enter your email address.', 'warning');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      showToast('Password reset email sent! Redirecting to login...', 'success');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 3000);
    } catch (err) {
      console.error("Password reset error:", err);
      showToast(err.message, 'error');
    }
  });
});
