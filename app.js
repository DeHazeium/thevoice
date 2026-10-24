import { firebaseConfig, eventId } from "./firebase-config.js";

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
  adapter: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const round = (value) => Math.round((Number(value) || 0) * 100) / 100;
const formatScore = (value) => round(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
const scoreKey = (artistId, judgeId) => `${artistId}_${judgeId}`;

class LocalAdapter {
  constructor() { this.key = `voice40-demo-v1-${eventId}`; }
  async start(onChange) {
    const saved = JSON.parse(localStorage.getItem(this.key) || "null");
    if (saved) Object.assign(state, saved);
    this.onChange = onChange;
    setSync("Demo mode", "offline");
  }
  persist() {
    localStorage.setItem(this.key, JSON.stringify({ contestants: state.contestants, scores: state.scores, settings: state.settings }));
    this.onChange?.();
  }
  async saveScore(score) { state.scores[scoreKey(score.artistId, score.judgeId)] = score; this.persist(); }
  async savePrevious(updates) {
    state.contestants = state.contestants.map((artist) => ({ ...artist, previousScore: updates[artist.id] ?? artist.previousScore }));
    this.persist();
  }
  async saveSettings(settings) { state.settings = settings; this.persist(); }
}

class FirebaseAdapter {
  async start(onChange) {
    const appSdk = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js");
    const authSdk = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js");
    const dbSdk = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js");
    const app = appSdk.initializeApp(firebaseConfig);
    this.db = dbSdk.getFirestore(app);
    this.fs = dbSdk;
    await authSdk.signInAnonymously(authSdk.getAuth(app));
    this.base = dbSdk.collection(this.db, "events", eventId, "contestants");
    this.scores = dbSdk.collection(this.db, "events", eventId, "scores");
    this.settings = dbSdk.doc(this.db, "events", eventId, "config", "main");
    await this.seed();
    dbSdk.onSnapshot(this.base, (snapshot) => {
      if (!snapshot.empty) state.contestants = snapshot.docs.map((item) => item.data()).sort((a,b) => a.order - b.order);
      onChange(); setSync("Live sync", "online");
    }, () => setSync("Sync error", "offline"));
    dbSdk.onSnapshot(this.scores, (snapshot) => {
      state.scores = Object.fromEntries(snapshot.docs.map((item) => [item.id, item.data()]));
      onChange();
    });
    dbSdk.onSnapshot(this.settings, (snapshot) => {
      if (snapshot.exists()) state.settings = { ...DEFAULT_SETTINGS, ...snapshot.data() };
      onChange();
    });
  }
  async seed() {
    const { getDocs, getDoc, writeBatch, doc, setDoc } = this.fs;
    const [contestantsSnapshot, settingsSnapshot] = await Promise.all([getDocs(this.base), getDoc(this.settings)]);
    if (contestantsSnapshot.empty) {
      const batch = writeBatch(this.db);
      CONTESTANTS.forEach((artist) => batch.set(doc(this.base, artist.id), artist));
      await batch.commit();
    }
    if (!settingsSnapshot.exists()) await setDoc(this.settings, DEFAULT_SETTINGS);
  }
  async saveScore(score) {
    const ref = this.fs.doc(this.scores, scoreKey(score.artistId, score.judgeId));
    await this.fs.setDoc(ref, { ...score, updatedAt: this.fs.serverTimestamp() }, { merge: true });
  }
  async savePrevious(updates) {
    const batch = this.fs.writeBatch(this.db);
    for (const [id, previousScore] of Object.entries(updates)) batch.update(this.fs.doc(this.base, id), { previousScore });
    await batch.commit();
  }
  async saveSettings(settings) { await this.fs.setDoc(this.settings, settings, { merge: true }); }
}

function isFirebaseConfigured() {
  return firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("PASTE_") && firebaseConfig.projectId && !firebaseConfig.projectId.includes("PASTE_");
}

function setSync(label, mode) {
  const target = $("#syncStatus");
  target.lastChild.textContent = ` ${label}`;
  target.className = `sync-pill ${mode || ""}`;
}

function scoreFor(artistId, judgeId) {
  return state.scores[scoreKey(artistId, judgeId)] || { values: ["", "", "", ""], total: 0, submitted: false };
}

function calculate(artist) {
  const judgeScores = ["judge1", "judge2", "judge3"].map((judge) => scoreFor(artist.id, judge));
  const complete = judgeScores.filter((score) => score.submitted).length;
  const roundScore = round(judgeScores.reduce((sum, score) => sum + (Number(score.total) || 0), 0) / 3);
  const previous = Number(artist.previousScore) || 0;
  return { judgeScores, complete, roundScore, overall: round(previous + roundScore) };
}

function rankedContestants() {
  return state.contestants.map((artist) => ({ ...artist, result: calculate(artist) }))
    .sort((a,b) => b.result.overall - a.result.overall || b.result.roundScore - a.result.roundScore || a.order - b.order);
}

function renderScoreboard() {
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
      <input id="criterion${index}" data-score-input="${index}" type="number" min="0" max="${state.settings.maxScore}" step="0.1" inputmode="decimal" value="${score.values?.[index] ?? ""}" placeholder="0" />
    </div>`).join("");
  $("#judgeMax").textContent = ` / ${state.settings.maxScore * 4}`;
  updateJudgeTotal();
  $$('[data-score-input]').forEach((input) => input.addEventListener("input", updateJudgeTotal));
}

function updateJudgeTotal() {
  const max = Number(state.settings.maxScore);
  let total = 0;
  $$('[data-score-input]').forEach((input) => {
    if (Number(input.value) > max) input.value = max;
    if (Number(input.value) < 0) input.value = 0;
    total += Number(input.value) || 0;
  });
  $("#judgeTotal").textContent = formatScore(total);
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
  if (state.judgeId) renderJudgePanel();
}

async function saveCurrentScore() {
  const artist = state.contestants[state.selectedArtist];
  const values = $$('[data-score-input]').map((input) => input.value === "" ? "" : round(input.value));
  if (values.some((value) => value === "")) return showToast("Please score all four criteria");
  const score = { artistId: artist.id, judgeId: state.judgeId, values, total: round(values.reduce((sum, value) => sum + Number(value), 0)), submitted: true };
  setSync("Saving…", "");
  try {
    await state.adapter.saveScore(score);
    showToast(`${artist.stageName} score saved`);
    if (state.selectedArtist < state.contestants.length - 1) state.selectedArtist += 1;
    renderAll();
    if (state.adapter instanceof LocalAdapter) setSync("Demo mode", "offline"); else setSync("Live sync", "online");
  } catch (error) { console.error(error); setSync("Save failed", "offline"); showToast("Could not save — check Firebase setup"); }
}

function exportCsv() {
  const header = ["Rank","Stage name","Name","Judge 1","Judge 2","Judge 3","Previous score","Round 2 average","Overall total"];
  const rows = rankedContestants().map((artist, index) => [index + 1, artist.stageName, artist.name, ...artist.result.judgeScores.map((score) => score.total || 0), artist.previousScore || 0, artist.result.roundScore, artist.result.overall]);
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
    const updates = Object.fromEntries($$("[data-manual-id]").map((input) => [input.dataset.manualId, Math.max(0, round(input.value))]));
    try { await state.adapter.savePrevious(updates); $("#manualDialog").close(); showToast("Previous scores updated"); renderAll(); }
    catch (error) { console.error(error); showToast("Could not save previous scores"); }
  });
  $("#settingsButton").addEventListener("click", () => { renderSettings(); $("#settingsDialog").showModal(); });
  $("#saveSettings").addEventListener("click", async (event) => {
    event.preventDefault();
    const criteria = $$("[data-setting-criterion]").map((input, index) => input.value.trim() || `Criterion ${index + 1}`);
    const maxScore = Math.min(100, Math.max(1, Number($("#maxScoreInput").value) || 10));
    try { await state.adapter.saveSettings({ criteria, maxScore }); $("#settingsDialog").close(); showToast("Scoring setup updated"); renderAll(); }
    catch (error) { console.error(error); showToast("Could not save setup"); }
  });
  $("#exportButton").addEventListener("click", exportCsv);
}

async function init() {
  bindEvents(); renderAll();
  $("#judgeLock").classList.toggle("hidden", Boolean(state.judgeId));
  $("#scoringLayout").classList.toggle("hidden", !state.judgeId);
  state.adapter = isFirebaseConfigured() ? new FirebaseAdapter() : new LocalAdapter();
  try { await state.adapter.start(renderAll); renderAll(); }
  catch (error) {
    console.error(error); state.adapter = new LocalAdapter(); await state.adapter.start(renderAll);
    showToast("Firebase unavailable — running in demo mode"); renderAll();
  }
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

init();
