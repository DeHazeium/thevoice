# The Voice 4.0 Scoreboard

A responsive, real-time scoring app for 14 contestants, three judges and four configurable scoring criteria.

## What it does

- Each device selects Judge 1, 2 or 3 and scores every contestant.
- Four criterion scores are totaled for each judge.
- Round 2 is calculated as `(Judge 1 + Judge 2 + Judge 3) ÷ 3`.
- Previous-round scores can be entered manually and are added to Round 2 for the overall ranking.
- Firebase Firestore keeps every device in sync in real time.
- The scoreboard can be exported as CSV.

## Firebase setup

1. Create a Firebase project at <https://console.firebase.google.com/>.
2. Add a Web app in **Project settings → Your apps**.
3. Copy the web configuration into `firebase-config.js`.
4. In **Build → Authentication → Sign-in method**, enable **Anonymous** sign-in.
5. In **Build → Firestore Database**, create a database.
6. Open **Firestore Database → Rules**, paste the contents of `firestore.rules`, and publish the rules.
7. In **Authentication → Settings → Authorized domains**, add your GitHub Pages hostname, such as `yourname.github.io`.

Until Firebase is configured, the app automatically runs in demo mode using this browser's local storage.

## GitHub Pages deployment

1. Create a GitHub repository and upload/push every file in this folder.
2. Open **Settings → Pages** in the repository.
3. Under **Build and deployment**, choose **GitHub Actions** as the source.
4. Push to `main`. The included workflow publishes the site automatically.

The Firebase web config is a public client configuration, not a server secret. Access is protected by Firebase Authentication and Firestore rules.
