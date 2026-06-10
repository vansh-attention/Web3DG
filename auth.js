// ============================================================================
// HOLO//ARCADE — Authentication (Firebase: Google + Facebook)
//
// Works in two modes:
//  - UNCONFIGURED: firebase-config.js still has placeholders. The UI works,
//    but provider buttons show a setup hint instead of signing in.
//  - CONFIGURED: real Firebase project keys present → popup sign-in goes live.
// ============================================================================

import { firebaseConfig } from './firebase-config.js';

const CONFIGURED = !firebaseConfig.apiKey.startsWith('YOUR_');

let auth = null;
let firebaseAuthModule = null;
let currentUser = null;

// — DOM —
const modal = document.getElementById('auth-modal');
const statusEl = document.getElementById('auth-status');
const signinBtn = document.getElementById('signin-btn');
const userChip = document.getElementById('user-chip');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const signoutBtn = document.getElementById('signout-btn');
const googleBtn = document.getElementById('google-btn');
const facebookBtn = document.getElementById('facebook-btn');

export function isConfigured() {
  return CONFIGURED;
}

export function getUser() {
  return currentUser;
}

export function openAuthModal(message) {
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  setStatus(message || '');
}

function closeAuthModal() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  setStatus('');
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

function updateNav(user) {
  if (user) {
    signinBtn.hidden = true;
    userChip.hidden = false;
    userAvatar.src =
      user.photoURL ||
      'data:image/svg+xml,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><circle cx="14" cy="14" r="14" fill="%23003840"/><text x="14" y="19" font-size="13" text-anchor="middle" fill="%2300fff2">◈</text></svg>'
        );
    userName.textContent = user.displayName || user.email || 'RUNNER';
  } else {
    signinBtn.hidden = false;
    userChip.hidden = true;
  }
}

async function signInWith(providerName) {
  if (!CONFIGURED) {
    setStatus(
      '⚠ AUTH OFFLINE — paste your Firebase keys into firebase-config.js (see FIREBASE_SETUP.md)'
    );
    return;
  }

  try {
    setStatus('⌁ OPENING SECURE CHANNEL…');
    const { GoogleAuthProvider, FacebookAuthProvider, signInWithPopup } =
      firebaseAuthModule;
    const provider =
      providerName === 'google'
        ? new GoogleAuthProvider()
        : new FacebookAuthProvider();
    await signInWithPopup(auth, provider);
    // onAuthStateChanged handles the rest
  } catch (err) {
    const messages = {
      'auth/popup-closed-by-user': '⚠ CHANNEL CLOSED — sign-in cancelled',
      'auth/popup-blocked': '⚠ POPUP BLOCKED — allow popups for this site',
      'auth/account-exists-with-different-credential':
        '⚠ IDENTITY CONFLICT — this email is linked to another provider',
      'auth/operation-not-allowed':
        '⚠ PROVIDER DISABLED — enable it in the Firebase console',
      'auth/unauthorized-domain':
        '⚠ DOMAIN UNAUTHORIZED — add this domain in Firebase console → Auth → Settings',
    };
    setStatus(messages[err.code] || `⚠ AUTH FAULT — ${err.code || err.message}`);
  }
}

export async function initAuth() {
  // Modal controls work regardless of Firebase state
  document.querySelectorAll('[data-modal-close]').forEach((el) => {
    el.addEventListener('click', closeAuthModal);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAuthModal();
  });

  googleBtn.addEventListener('click', () => signInWith('google'));
  facebookBtn.addEventListener('click', () => signInWith('facebook'));
  signoutBtn.addEventListener('click', async () => {
    if (auth && firebaseAuthModule) await firebaseAuthModule.signOut(auth);
  });

  if (!CONFIGURED) return;

  // Firebase SDK is only fetched when real keys exist
  const { initializeApp } = await import(
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'
  );
  firebaseAuthModule = await import(
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'
  );

  const app = initializeApp(firebaseConfig);
  auth = firebaseAuthModule.getAuth(app);

  firebaseAuthModule.onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateNav(user);
    if (user) closeAuthModal();
  });
}
