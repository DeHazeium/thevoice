import { firebaseConfig, eventId } from './firebase-config.js';
import { formatScore } from './score-math.js';
import { overlayContestant } from './standings.js';

const requestedRank = Number(new URLSearchParams(location.search).get('rank'));
const rank = [1, 2, 3].includes(requestedRank) ? requestedRank : 1;
const card = document.querySelector('#rankCard');
document.querySelector('#rankNumber').textContent = rank;
let connected = false;
let loaded = false;
let eventData = {};

function render() {
  const artist = connected && loaded
    ? overlayContestant(Object.values(eventData.contestants || {}), eventData.scores || {}, rank)
    : null;
  card.hidden = !artist;
  document.title = `The Voice 4.0 — Top ${rank} · ${!connected || !loaded ? 'Connecting' : artist ? 'Live' : 'Waiting for scores'}`;
  if (!artist) return;
  document.querySelector('#overlayName').textContent = artist.stageName;
  document.querySelector('#overlayLegalName').textContent = artist.name === artist.stageName ? '' : artist.name;
  document.querySelector('#overlayScore').textContent = formatScore(artist.result.overall);
}

async function connect() {
  const [{ initializeApp }, { getAuth, signInAnonymously }, { getDatabase, ref, onValue }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js')
  ]);
  const app = initializeApp(firebaseConfig);
  await signInAnonymously(getAuth(app));
  const database = getDatabase(app);
  onValue(ref(database, '.info/connected'), (snapshot) => { connected = snapshot.val() === true; render(); });
  // This page only reads scores; it never seeds or updates competition data.
  onValue(ref(database, `events/${eventId}`), (snapshot) => {
    eventData = snapshot.val() || {};
    loaded = true;
    render();
  }, (error) => { loaded = false; render(); document.title = `Top ${rank} — Firebase access unavailable`; console.error(error); });
}
render();
connect().catch((error) => { card.hidden = true; document.title = `Top ${rank} — Firebase connection failed`; console.error(error); });
