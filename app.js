import { firebaseConfig, eventId } from "./firebase-config.js";
import { round, sumScores, formatScore } from "./score-math.js";
import { rankContestants } from "./standings.js";

const CONTESTANTS = [
  { id: "yuri-j", name: "Yuricko", stageName: "Yuri J" },
  { id: "daeyan", name: "Bryan", stageName: "Daeyan" },
  { id: "luqman-akim", name: "Luqman Akim", stageName: "Luqman Akim" },
  { id: "tonyneo", name: "Anthonio Imang", stageName: "TonyNeo" },
  { id: "greg", name: "Greg", stageName: "Greg" },
  { id: "chel", name: "Cheryl", stageName: "Chel" },
  { id: "heazkie", name: "Heazkie", stageName: "Heazkie" },
  { id: "anniechan", name: "Nasreen", stageName: "Anniechan" },
  { id: "alley", name: "Alleyca", stageName: "Alley" },
  { id: "eva", name: "Eva", stageName: "Eva" },
  { id: "ellis", name: "Ellis", stageName: "Ellis" },
  { id: "vellyna", name: "Vellyna Elnie", stageName: "Vellyna" },
  { id: "ayeen", name: "Bathisyia Zurin Adrieana", stageName: "Ayeen" },
  { id: "syifa", name: "Nur Syifa", stageName: "Syifa" }
].map((artist, index) => ({ ...artist, order: index + 1, previousScore: 0 }));

const DEFAULT_SETTINGS = {
  criteria: ["Vocal quality", "Technique", "Stage presence", "Overall impact"],
  maxScore: 10
};

const state = {
  contestants: structuredClone(CONTESTANTS),
  scores: {},
  settings: structuredClone(DEFAULT_SETTINGS),
  judgeId: localStorage.getItem("voice40-judge-v1") || "",
  selectedArtist: 0,
  adapter: null,
  ready: false,
  connected: false,
  loaded: false
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const scoreKey = (artistId, judgeId) => `${artistId}_${judgeId}`;

class FirebaseAdapter {
  async start(onChange) {
    const appSdk = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js");
    const authSdk = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js");
    const dbSdk = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js");
    const app = appSdk.initializeApp(firebaseConfig);
    this.db = dbSdk.getDatabase(app);
    this.rtdb = dbSdk;
    await authSdk.signInAnonymously(authSdk.getAuth(app));
    this.basePath = `events/${eventId}`;
    this.base = dbSdk.ref(this.db, this.basePath);
    await this.seed();
    dbSdk.onValue(dbSdk.ref(this.db, '.info/connected'), (snapshot) => {
      state.connected = snapshot.val() === true;
      setSync(state.connected && state.loaded ? 'Live sync' : 'Connecting…', state.connected && state.loaded ? 'online' : 'offline');
      renderScoreboard();
    });
    dbSdk.onValue(this.base, (snapshot) => {
      const data = snapshot.val() || {};
      if (data.contestants) state.contestants = Object.values(data.contestants).sort((a,b) => a.order - b.order);
      state.scores = data.scores || {};
      state.settings = { ...DEFAULT_SETTINGS, ...data.config };
      state.loaded = true;
      setSync(state.connected ? 'Live sync' : 'Reconnecting…', state.connected ? 'online' : 'offline');
      onChange();
    }, (error) => {
      console.error(error);
      state.loaded = false;
      setSync('Connection unavailable', 'offline', connectionErrorMessage(error));
      renderScoreboard();
    });
  }
  async seed() {
    const snapshot = await this.rtdb.get(this.base);
    const existing = snapshot.val() || {};
    const updates = {};
    if (!existing.contestants) CONTESTANTS.forEach((artist) => { updates[`contestants/${artist.id}`] = artist; });
    if (!existing.config) updates.config = DEFAULT_SETTINGS;
    if (Object.keys(updates).length) await this.rtdb.update(this.base, updates);
  }
  async saveScore(score) {
    if (!state.ready) throw new Error('Live connection required');
    const target = this.rtdb.ref(this.db, `${this.basePath}/scores/${scoreKey(score.artistId, score.judgeId)}`);
    await this.rtdb.set(target, { ...score, updatedAt: this.rtdb.serverTimestamp() });
  }
  async savePrevious(updates) {
    if (!state.ready) throw new Error('Live connection required');
    const values = {};
    for (const [id, previousScore] of Object.entries(updates)) values[`${this.basePath}/contestants/${id}/previousScore`] = previousScore;
    await this.rtdb.update(this.rtdb.ref(this.db), values);
  }
  async saveSettings(settings) {
    if (!state.ready) throw new Error('Live connection required');
    await this.rtdb.update(this.rtdb.ref(this.db, `${this.basePath}/config`), settings);
  }
}

function isFirebaseConfigured() {
  return firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("PASTE_") && firebaseConfig.projectId && !firebaseConfig.projectId.includes("PASTE_");
}

function connectionErrorMessage(error) {
  const code = String(error.code || error.message || '').toLowerCase();
  if (/configuration-not-found|operation-not-allowed|admin-restricted-operation/.test(code)) return 'Firebase Anonymous sign-in is not enabled. Enable it in Firebase Authentication → Sign-in method, then reload this page.';
  if (/permission.denied/.test(code)) return 'Firebase database access was denied. The Realtime Database rules must allow this signed-in app to access events/the-voice-4. Reload after the rules are updated.';
  if (/unauthorized-domain/.test(code)) return 'Firebase has not authorized this website domain. Add dehazeium.github.io in Authentication settings, then reload.';
  return 'The shared scoreboard could not connect. Check your internet connection and Firebase configuration, then reload. Scores have not been saved.';
}

function setSync(label, mode, detail) {
  const target = $("#syncStatus");
  target.lastChild.textContent = ` ${label}`;
  target.className = `sync-pill ${mode || ""}`;
  state.ready = state.connected && state.loaded && mode !== 'offline';
  ['saveScore', 'saveManual', 'saveSettings', 'exportButton'].forEach((id) => { $(`#${id}`).disabled = !state.ready; });
  const notice = $('#connectionNotice');
  notice.classList.toggle('hidden', state.ready);
  notice.classList.toggle('failed', mode === 'offline');
  notice.textContent = detail || (mode === 'offline'
    ? 'The shared scoreboard is unavailable. Scores cannot be loaded or saved. Check the connection and Firebase access, then reload this page.'
    : 'Connecting to the shared scoreboard…');
}

function scoreFor(artistId, judgeId) {
  return state.scores[scoreKey(artistId, judgeId)] || { values: ["", "", "", ""], total: 0, submitted: false };
}

function rankedContestants() {
  return rankContestants(state.contestants, state.scores);
}

function renderScoreboard() {
  if (!state.ready) {
    $('#leaderPodium').innerHTML = '';
    $('#scoreboardRows').innerHTML = '<div class="empty-state"><strong>Waiting for the shared scoreboard.</strong>Rankings will appear when the live connection is available.</div>';
    return;
  }
  const ranking = rankedContestants();
  $("#leaderPodium").innerHTML = ranking.slice(0, 3).map((artist, index) => `
    <article class="leader-card">
      <span class="leader-rank">${index + 1}</span>
      <small>${index === 0 ? "Current leader" : `Position ${index + 1}`}</small>
      <h3>${escapeHtml(artist.stageName)}</h3>
      <p>${escapeHtml(artist.name)}</p>
      <span class="leader-score">${formatScore(artist.result.overall)} pts</span>
    </article>`).join("");

  $("#scoreboardRows").innerHTML = ranking.map((artist, index) => `
    <div class="score-row">
      <span class="rank ${index < 3 ? "top" : ""}">${String(index + 1).padStart(2,"0")}</span>
      <span class="artist-cell"><strong>${escapeHtml(artist.stageName)}</strong><small>${escapeHtml(artist.name)}</small></span>
      <span class="judge-dots" aria-label="${artist.result.complete} of 3 judges scored">
        ${artist.result.judgeScores.map((score, judgeIndex) => `<i class="${score.submitted ? "done" : ""}">${judgeIndex + 1}</i>`).join("")}
      </span>
      <span class="number-cell previous">${formatScore(artist.previousScore)}</span>
      <span class="number-cell round">${formatScore(artist.result.roundScore)}</span>
      <span class="total-cell">${formatScore(artist.result.overall)}</span>
    </div>`).join("");
}

function renderArtistList() {
  if (!state.judgeId) return;
  const completed = state.contestants.filter((artist) => scoreFor(artist.id, state.judgeId).submitted).length;
  $("#progressText").textContent = `${completed} / ${state.contestants.length} scored`;
  $("#progressBar").style.width = `${completed / state.contestants.length * 100}%`;
  $("#artistList").innerHTML = state.contestants.map((artist, index) => {
    const done = scoreFor(artist.id, state.judgeId).submitted;
    return `<button class="artist-button ${state.selectedArtist === index ? "active" : ""}" data-index="${index}" type="button">
      <span class="mini-number">${String(index + 1).padStart(2,"0")}</span>
      <span><strong>${escapeHtml(artist.stageName)}</strong><small>${escapeHtml(artist.name)}</small></span>
      <span class="check ${done ? "done" : ""}"></span>
    </button>`;
  }).join("");
  $$(".artist-button").forEach((button) => button.addEventListener("click", () => {
    state.selectedArtist = Number(button.dataset.index); renderJudgePanel();
  }));
}

function renderJudgePanel() {
  if (!state.judgeId) return;
  renderArtistList();
  const artist = state.contestants[state.selectedArtist];
  const score = scoreFor(artist.id, state.judgeId);
  $("#artistNumber").textContent = String(artist.order).padStart(2,"0");
  $("#legalName").textContent = artist.name;
  $("#stageName").textContent = artist.stageName;
  $("#draftStatus").textContent = score.submitted ? "Saved to scoreboard" : "Not scored";
  $("#draftStatus").className = `draft-status ${score.submitted ? "saved" : ""}`;
  $("#criteriaGrid").innerHTML = state.settings.criteria.map((criterion, index) => `
    <div class="criterion">
      <label for="criterion${index}"><span>${escapeHtml(criterion)}</span><small>max ${state.settings.maxScore}</small></label>
      <input id="criterion${index}" data-score-input="${index}" type="number" min="0" max="${state.settings.maxScore}" step="0.01" inputmode="decimal" value="${score.values?.[index] ?? ""}" placeholder="0.00" />
    </div>`).join("");
  $("#judgeMax").textContent = ` / ${state.settings.maxScore * 4}`;
  updateJudgeTotal();
  $$('[data-score-input]').forEach((input) => input.addEventListener("input", updateJudgeTotal));
}

function updateJudgeTotal() {
  const max = Number(state.settings.maxScore);
  $$('[data-score-input]').forEach((input) => {
    if (Number(input.value) > max) input.value = max;
    if (Number(input.value) < 0) input.value = 0;
  });
  $("#judgeTotal").textContent = formatScore(sumScores($$('[data-score-input]').map((input) => input.value)));
}

function renderManualList() {
  $("#manualList").innerHTML = state.contestants.map((artist, index) => `
    <label class="manual-row">
      <span>${String(index + 1).padStart(2,"0")}</span>
      <span><strong>${escapeHtml(artist.stageName)}</strong><small>${escapeHtml(artist.name)}</small></span>
      <input data-manual-id="${artist.id}" type="number" min="0" step="0.01" inputmode="decimal" value="${Number(artist.previousScore) || 0}" aria-label="Previous-round score for ${escapeHtml(artist.stageName)}" />
    </label>`).join("");
}

function renderSettings() {
  $("#settingsFields").innerHTML = state.settings.criteria.map((criterion, index) => `
    <label class="field-row"><span>Criterion ${index + 1}</span><input data-setting-criterion="${index}" value="${escapeHtml(criterion)}" maxlength="40" /></label>`).join("");
  $("#maxScoreInput").value = state.settings.maxScore;
}

function renderAll() {
  renderScoreboard();
  // A judge's in-progress input must survive another judge's live update.
  if (state.judgeId && !document.activeElement?.matches('[data-score-input]')) renderJudgePanel();
}

async function saveCurrentScore() {
  if (!state.ready) return showToast('Connect to the shared scoreboard before saving');
  const artist = state.contestants[state.selectedArtist];
  if ($$('[data-score-input]').some((input) => !input.reportValidity())) return showToast('Use scores with up to two decimal places');
  const values = $$('[data-score-input]').map((input) => input.value === "" ? "" : round(input.value));
  if (values.some((value) => value === "")) return showToast("Please score all four criteria");
  const score = { artistId: artist.id, judgeId: state.judgeId, values, total: sumScores(values), submitted: true };
  setSync("Saving…", "");
  try {
    await state.adapter.saveScore(score);
    showToast(`${artist.stageName} score saved`);
    if (state.selectedArtist < state.contestants.length - 1) state.selectedArtist += 1;
    renderAll();
    setSync("Live sync", "online");
  } catch (error) { console.error(error); setSync("Save failed", "offline"); showToast("Could not save — check Firebase setup"); }
}

function exportCsv() {
  const header = ["Rank","Stage name","Name","Judge 1","Judge 2","Judge 3","Previous score","Round 2 average","Overall total"];
  const rows = rankedContestants().map((artist, index) => [index + 1, artist.stageName, artist.name, ...[...artist.result.judgeScores.map((score) => score.total || 0), artist.previousScore || 0, artist.result.roundScore, artist.result.overall].map((value) => round(value).toFixed(2))]);
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"','""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = `the-voice-4-scoreboard-${new Date().toISOString().slice(0,10)}.csv`;
  link.click(); URL.revokeObjectURL(link.href);
}

function switchView(view) {
  $$(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  $$(".view").forEach((panel) => panel.classList.toggle("active", panel.id === `${view}View`));
}

function showToast(message) {
  const toast = $("#toast"); toast.textContent = message; toast.classList.add("show");
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
}

function bindEvents() {
  $('#obsButton').addEventListener('click', () => {
    $('#obsLinks').innerHTML = [1, 2, 3].map((rank) => {
      const url = new URL(`overlay.html?rank=${rank}`, location.href).href;
      return `<div class="obs-link-row"><strong>Top ${rank}</strong><input readonly aria-label="Top ${rank} OBS URL" value="${escapeHtml(url)}" /><div><button type="button" class="secondary-button" data-copy-rank="${rank}">Copy URL</button><a class="primary-button compact" href="${escapeHtml(url)}" target="_blank" rel="noopener">Open Top ${rank} ↗</a></div></div>`;
    }).join('');
    $$('[data-copy-rank]').forEach((button) => button.addEventListener('click', async () => {
      const input = button.closest('.obs-link-row').querySelector('input');
      try { await navigator.clipboard.writeText(input.value); showToast(`Top ${button.dataset.copyRank} URL copied`); }
      catch { input.focus(); input.select(); showToast('Select and copy this overlay URL'); }
    }));
    $('#obsDialog').showModal();
  });
  $$(".tab").forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
  $("#judgeSelect").value = state.judgeId;
  $("#judgeSelect").addEventListener("change", (event) => {
    state.judgeId = event.target.value; localStorage.setItem("voice40-judge-v1", state.judgeId);
    $("#judgeLock").classList.toggle("hidden", Boolean(state.judgeId));
    $("#scoringLayout").classList.toggle("hidden", !state.judgeId);
    if (state.judgeId) renderJudgePanel();
  });
  $("#saveScore").addEventListener("click", saveCurrentScore);
  $("#previousArtist").addEventListener("click", () => { state.selectedArtist = Math.max(0, state.selectedArtist - 1); renderJudgePanel(); });
  $("#manualButton").addEventListener("click", () => { renderManualList(); $("#manualDialog").showModal(); });
  $("#saveManual").addEventListener("click", async (event) => {
    event.preventDefault();
    if (!state.ready) return showToast('Connect to the shared scoreboard before saving');
    if ($$('[data-manual-id]').some((input) => !input.reportValidity())) return showToast('Use scores with up to two decimal places');
    const updates = Object.fromEntries($$("[data-manual-id]").map((input) => [input.dataset.manualId, Math.max(0, round(input.value))]));
    try { await state.adapter.savePrevious(updates); $("#manualDialog").close(); showToast("Previous scores updated"); renderAll(); }
    catch (error) { console.error(error); showToast("Could not save previous scores"); }
  });
  $("#settingsButton").addEventListener("click", () => { renderSettings(); $("#settingsDialog").showModal(); });
  $("#saveSettings").addEventListener("click", async (event) => {
    event.preventDefault();
    if (!state.ready) return showToast('Connect to the shared scoreboard before saving');
    const criteria = $$("[data-setting-criterion]").map((input, index) => input.value.trim() || `Criterion ${index + 1}`);
    const maxScore = Math.min(100, Math.max(1, Number($("#maxScoreInput").value) || 10));
    try { await state.adapter.saveSettings({ criteria, maxScore }); $("#settingsDialog").close(); showToast("Scoring setup updated"); renderAll(); }
    catch (error) { console.error(error); showToast("Could not save setup"); }
  });
  $("#exportButton").addEventListener("click", exportCsv);
}

async function init() {
  bindEvents(); setSync('Connecting…', ''); renderAll();
  $("#judgeLock").classList.toggle("hidden", Boolean(state.judgeId));
  $("#scoringLayout").classList.toggle("hidden", !state.judgeId);
  if (!isFirebaseConfigured()) {
    setSync("Firebase not configured", "offline");
    showToast("Firebase configuration is required");
    return;
  }
  state.adapter = new FirebaseAdapter();
  try { await state.adapter.start(renderAll); renderAll(); }
  catch (error) {
    console.error(error);
    setSync("Firebase connection failed", "offline", connectionErrorMessage(error));
    showToast("Live sync unavailable — check Firebase access");
    renderAll();
  }
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("./service-worker.js?v=10").catch(() => {});
}

init();
