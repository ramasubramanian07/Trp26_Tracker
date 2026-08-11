# Family Trip Coordinator

A private, mobile-friendly app for coordinating your family trip: one Admin manages
coordinators and passengers; each coordinator sees and checks in only their own
assigned family members. Everything updates live — no refresh needed.

Follow these steps **in order**. It takes about 20 minutes the first time.

---

## Part 1 — Create your Firebase project (free)

1. Go to https://console.firebase.google.com and sign in with any Google account.
2. Click **Add project** → name it e.g. `family-trip-2026` → continue through the
   prompts (Google Analytics can be turned off) → **Create project**.
3. In the left sidebar, click the **⚙ gear icon → Project settings**.
4. Under "Your apps", click the **`</>`  (web)** icon to register a web app.
   Give it any nickname (e.g. "trip-web") → **Register app**.
5. Firebase will show a `firebaseConfig` object with keys like `apiKey`,
   `authDomain`, etc. Keep this tab open — you'll copy these in Part 3.

### Turn on Authentication
6. Left sidebar → **Build → Authentication → Get started**.
7. Under **Sign-in method**, enable **Email/Password** → Save.

### Turn on Firestore (the database)
8. Left sidebar → **Build → Firestore Database → Create database**.
9. Choose a location close to you → start in **Production mode** → Enable.
10. Go to the **Rules** tab of Firestore. Delete everything there and paste in
    the entire contents of **`firestore.rules`** from this project. Click **Publish**.

That's it for Firebase — you won't need to touch the console again for normal use
(one small exception noted in Part 5).

---

## Part 2 — Put the code on GitHub

1. Go to your GitHub repository (the one you already have ready).
2. Upload every file from this project, **keeping the folder structure**:
   ```
   index.html
   README.md
   firestore.rules
   css/style.css
   js/app.js
   js/firebase-config.js
   ```
   Easiest way: on the repo page, click **Add file → Upload files**, drag in
   the whole project folder, and commit.

---

## Part 3 — Connect the code to your Firebase project

1. In your GitHub repo, open **`js/firebase-config.js`** and click the pencil
   (Edit) icon.
2. Replace the placeholder values with the real values from the `firebaseConfig`
   object you saw in Part 1, step 5. It should end up looking like:
   ```js
   const firebaseConfig = {
     apiKey: "AIzaSyD...",
     authDomain: "family-trip-2026.firebaseapp.com",
     projectId: "family-trip-2026",
     storageBucket: "family-trip-2026.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```
3. Leave `PIN_SALT` as-is (or change it to any short word — just do this
   **before** you create any coordinators, not after).
4. Commit the change directly to the `main` branch.

---

## Part 4 — Publish with GitHub Pages

1. In your repo, go to **Settings → Pages**.
2. Under "Build and deployment" → Source, choose **Deploy from a branch**.
3. Branch: **main**, folder: **/ (root)** → **Save**.
4. Wait about a minute, then refresh the page — GitHub will show your live
   link, something like:
   ```
   https://yourusername.github.io/your-repo-name/
   ```
5. Open that link. This is the single link you'll share with everyone —
   admin and coordinators alike log in from the same page.

---

## Part 5 — First login (creates your Admin account)

1. Open your published link. Since no admin exists yet, you'll see
   **"Create Admin Account"** instead of a login form.
2. Enter your name, choose an admin username, and a password (6+ characters).
   This is *your* real login going forward — pick something you'll remember.
3. Click **Create Admin Account** — you're now in the Admin Dashboard.

**Changing a coordinator's PIN later:** the app can create coordinators and
edit their names/status directly, but resetting an *existing* coordinator's
PIN needs one manual step in Firebase Console → Authentication → find their
`username@trip.local` entry → **Reset password**. This is a Firebase platform
limitation, not something the app can work around from the browser.

---

## Part 6 — Day-to-day use

**As Admin:**
- **Coordinators tab** → Add Coordinator for each family lead (e.g. Ravi,
  username `Ravi`, PIN `1308`).
- **Passengers tab** → Add each passenger, assigning them to a coordinator,
  boarding point, coach/seat, and food preference.
- **Dashboard** and **Status** tabs show live progress and exactly who's
  still pending, updating automatically as coordinators check people in.

**As a Coordinator:**
- Share the same link with them, tell them to tap **Coordinator**, and give
  them their username + PIN.
- They'll see only their assigned passengers as boarding-pass style cards,
  with one-tap checklist items (Aadhaar, Ticket, Station, Boarded, Food) and
  Present/Absent buttons.

Everything syncs in real time — when a coordinator taps a checkbox, the
Admin dashboard updates within a second or two, on any device.

---

## Notes on data & privacy

- No Aadhaar numbers or ticket images are stored — only verified/not-verified
  checkboxes, per the original spec.
- This is sized for a private, trusted group (~40 people, a handful of
  coordinators). It is **not** hardened for public/internet-facing use
  beyond that scope — don't reuse these PINs or this project for anything
  more sensitive.
- Deleting a coordinator is blocked while they still have passengers
  assigned, to avoid orphaned records — reassign those passengers first.

## Troubleshooting

- **"Setup Required" screen on first load** → you skipped Part 3; the
  placeholder keys are still in `firebase-config.js`.
- **Login fails for everyone** → double check Email/Password sign-in is
  enabled in Firebase Authentication (Part 1, step 7).
- **"Missing or insufficient permissions" errors** → the Firestore rules
  weren't pasted/published correctly (Part 1, step 10).
