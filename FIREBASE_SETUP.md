# Firebase Auth Setup — HOLO//ARCADE

The landing page ships with sign-in wired up but **offline** until you add your
own Firebase project keys. Takes ~5 minutes for Google, a bit longer for Facebook.

## 1. Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Add project** (e.g. `holo-arcade`).
2. In the project, click the **`</>` (Web)** icon to register a web app.
3. Copy the `firebaseConfig` object it shows you into [firebase-config.js](firebase-config.js), replacing the `YOUR_*` placeholders.

## 2. Enable Google sign-in (easy)

1. Firebase console → **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Google** → Enable → pick a support email → Save.

That's it — Google sign-in works immediately.

## 3. Enable Facebook sign-in (needs a Facebook app)

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps → Create App** → type "Consumer".
2. In the app: **Add product → Facebook Login → Web**.
3. Copy the **App ID** and **App Secret** (Settings → Basic).
4. Firebase console → Authentication → Sign-in method → **Facebook** → Enable → paste App ID + Secret.
5. Firebase shows you an **OAuth redirect URI** — paste that into the Facebook app under **Facebook Login → Settings → Valid OAuth Redirect URIs**.

## 4. Authorize your domains

Firebase console → Authentication → **Settings → Authorized domains**:
- `localhost` is already there (for local dev)
- Add your production domain when you deploy

## 5. Run locally

ES modules don't load from `file://`, so serve the folder:

```bash
cd "/Users/vansh_uni/Documents/Websites (3D.js)"
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Notes

- The `firebaseConfig` values are **not secrets** — they're project identifiers,
  safe to commit. Access control comes from the authorized-domains list and
  Firebase security rules.
- Until real keys are in `firebase-config.js`, the sign-in buttons show an
  "AUTH OFFLINE" hint and game links stay open (dev mode). Once configured,
  playing a game requires sign-in.
