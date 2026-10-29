# The Voice 4.0 Scoreboard

A responsive, real-time scoring app for 14 contestants, three judges and four configurable scoring criteria.

## What it does

- Each device selects Judge 1, 2 or 3 and scores every contestant.
- Four criterion scores are totaled for each judge.
- Criterion and previous-round scores accept up to two decimal places. Totals, averages and CSV exports display two decimal places; sums use whole hundredths to avoid floating-point drift.
- Round 2 is calculated as `(Judge 1 + Judge 2 + Judge 3) ÷ 3`.
- Previous-round scores can be entered manually and are added to Round 2 for the overall ranking.
- Firebase Realtime Database keeps every device in sync in real time.
- The scoreboard can be exported as CSV.

## Editing and resetting scores

Use **Edit current scores** to select an artist and judge and correct their four criteria to two decimal places. Saving updates only that judge's entry. If another device changes it before you save, the correction is rejected until you reload the saved score.

**Reset all to zero** requires typing `RESET`. It atomically zeros all current criteria and previous-round scores, marks every judge entry unsubmitted, and refreshes all devices and overlays. Pause judging before resetting. Names and settings are preserved. The latest pre-reset scores are retained at `events/the-voice-4/lastResetBackup` in Firebase (scores and previousScores); a later reset replaces this backup.

## OBS overlays

Click **OBS overlays** on the scoreboard to copy or open separate Top 1, Top 2 and Top 3 green-screen URLs. Add each as an OBS Browser Source with a 1600 × 400 viewport and a Green Chroma Key filter. Toggle each source independently for your broadcast.

The overlays subscribe to real Firebase standings and display the same overall ranking and two-decimal score as the scoreboard. They never write scores. A disconnected or unscored position is hidden, leaving only the green background. Rankings are live, not a final-results lock; ties retain the scoreboard's Round 2 and contestant-order tie-breaks.

## Firebase setup

This project is already connected to the `thevoice-cbc19` Firebase project.

1. In **Build → Authentication → Sign-in method**, enable **Anonymous** sign-in.
2. Open **Realtime Database → Rules**, paste the contents of `database.rules.json`, and publish the rules.
3. In **Authentication → Settings → Authorized domains**, add your GitHub Pages hostname, such as `yourname.github.io`.

The app is live-sync-only. If Firebase is unavailable or access is denied, it displays a connection error and does not save scores locally.

## GitHub Pages deployment

1. Create a GitHub repository and upload/push every file in this folder.
2. Open **Settings → Pages** in the repository.
3. Under **Build and deployment**, choose **GitHub Actions** as the source.
4. Push to `main`. The included workflow publishes the site automatically.

The Firebase web config is a public client configuration, not a server secret. Access is controlled by Firebase Authentication and Realtime Database rules. The provided rules permit any authenticated user (including anonymous users) to edit event data; judge selection is not a security boundary.
