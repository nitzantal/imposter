(() => {
  "use strict";

  const MIN_PLAYERS = 3;
  const MAX_PLAYERS = 20;
  const MIN_SECONDS = 1;
  const MAX_SECONDS = 30;

  const $ = (id) => document.getElementById(id);

  const setupScreen = $("setupScreen");
  const gameScreen = $("gameScreen");
  const setupForm = $("setupForm");
  const playerCountInput = $("playerCount");
  const revealSecondsInput = $("revealSeconds");
  const decreasePlayers = $("decreasePlayers");
  const increasePlayers = $("increasePlayers");
  const boxesEl = $("boxes");
  const progressText = $("progressText");
  const timerSetting = $("timerSetting");
  const newGameBtn = $("newGameBtn");
  const playAgainBtn = $("playAgainBtn");
  const revealOverlay = $("revealOverlay");
  const finishOverlay = $("finishOverlay");
  const revealCard = revealOverlay.querySelector(".reveal-card");
  const revealBadge = $("revealBadge");
  const revealTitle = $("revealTitle");
  const countdown = $("countdown");

  let state = null;

  function clampInt(value, min, max, fallback) {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function randomInt(maxExclusive) {
    return Math.floor(Math.random() * maxExclusive);
  }

  function pickWord() {
    if (!Array.isArray(HEBREW_WORDS) || HEBREW_WORDS.length === 0) {
      throw new Error("Hebrew vocabulary is empty.");
    }
    return HEBREW_WORDS[randomInt(HEBREW_WORDS.length)];
  }

  function createGame(players, seconds) {
    const imposterIndex = randomInt(players);
    state = {
      players,
      seconds,
      word: pickWord(),
      imposterIndex,
      used: Array(players).fill(false),
      usedCount: 0
    };
  }

  function renderBoxes() {
    boxesEl.replaceChildren();

    for (let i = 0; i < state.players; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "box" + (state.used[i] ? " used" : "");
      button.dataset.index = String(i);
      button.disabled = state.used[i];
      button.setAttribute("aria-label", state.used[i] ? `קופסה ${i + 1}, כבר נפתחה` : `פתח קופסה ${i + 1}`);

      const number = document.createElement("div");
      number.className = "box-number";
      number.textContent = state.used[i] ? "✓" : String(i + 1);

      const label = document.createElement("div");
      label.className = "box-label";
      label.textContent = state.used[i] ? "נפתחה" : "לחץ לפתיחה";

      button.append(number, label);
      button.addEventListener("click", () => openBox(i));
      boxesEl.appendChild(button);
    }

    progressText.textContent = `נבחרו ${state.usedCount} מתוך ${state.players}`;
    timerSetting.textContent = `חשיפה: ${state.seconds} שנ׳`;
  }

  function openBox(index) {
    if (!state || state.used[index]) return;

    state.used[index] = true;
    state.usedCount += 1;
    renderBoxes();

    const isImposter = index === state.imposterIndex;
    revealCard.classList.toggle("imposter", isImposter);
    revealBadge.textContent = isImposter ? "התגלה המתחזה" : "המילה שלך";
    revealTitle.textContent = isImposter ? "המתחזה" : state.word;
    countdown.textContent = String(state.seconds);
    revealOverlay.classList.remove("hidden");

    let remaining = state.seconds;
    const tick = window.setInterval(() => {
      remaining -= 1;
      countdown.textContent = String(Math.max(0, remaining));
    }, 1000);

    window.setTimeout(() => {
      window.clearInterval(tick);
      revealOverlay.classList.add("hidden");

      if (state.usedCount === state.players) {
        finishOverlay.classList.remove("hidden");
      }
    }, state.seconds * 1000);
  }

  function startGame(event) {
    event.preventDefault();

    const players = clampInt(playerCountInput.value, MIN_PLAYERS, MAX_PLAYERS, 6);
    const seconds = clampInt(revealSecondsInput.value, MIN_SECONDS, MAX_SECONDS, 5);

    playerCountInput.value = String(players);
    revealSecondsInput.value = String(seconds);

    createGame(players, seconds);
    setupScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    revealOverlay.classList.add("hidden");
    finishOverlay.classList.add("hidden");
    renderBoxes();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showSetup() {
    revealOverlay.classList.add("hidden");
    finishOverlay.classList.add("hidden");
    gameScreen.classList.add("hidden");
    setupScreen.classList.remove("hidden");
    playerCountInput.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  decreasePlayers.addEventListener("click", () => {
    playerCountInput.value = String(
      clampInt(playerCountInput.value, MIN_PLAYERS, MAX_PLAYERS, 6) - 1
    );
    if (Number(playerCountInput.value) < MIN_PLAYERS) playerCountInput.value = String(MIN_PLAYERS);
  });

  increasePlayers.addEventListener("click", () => {
    playerCountInput.value = String(
      clampInt(playerCountInput.value, MIN_PLAYERS, MAX_PLAYERS, 6) + 1
    );
    if (Number(playerCountInput.value) > MAX_PLAYERS) playerCountInput.value = String(MAX_PLAYERS);
  });

  setupForm.addEventListener("submit", startGame);
  newGameBtn.addEventListener("click", showSetup);
  playAgainBtn.addEventListener("click", showSetup);

  // Keep the UI sane even if the user types invalid values.
  playerCountInput.addEventListener("blur", () => {
    playerCountInput.value = String(
      clampInt(playerCountInput.value, MIN_PLAYERS, MAX_PLAYERS, 6)
    );
  });

  revealSecondsInput.addEventListener("blur", () => {
    revealSecondsInput.value = String(
      clampInt(revealSecondsInput.value, MIN_SECONDS, MAX_SECONDS, 5)
    );
  });
})();
