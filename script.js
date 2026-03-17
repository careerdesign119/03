const API_URL = "https://script.google.com/macros/s/AKfycbwpVdjyHWAveoFhkPDyJCVip8F_qJYERkqfGd0VxfirISrYEfXeLJd64qHnt__eGQsarQ/exec";
const POLL_INTERVAL = 2000;

const leaderboardEl = document.getElementById("leaderboard");
const emptyStateEl = document.getElementById("emptyState");
const teamCountEl = document.getElementById("teamCount");
const topScoreEl = document.getElementById("topScore");
const lastUpdatedEl = document.getElementById("lastUpdated");
const template = document.getElementById("teamCardTemplate");

let previousOrder = [];
let previousScores = new Map();
let pollingTimer = null;
let isFetching = false;

function normalizeTeam(row) {
  return {
    teamName: String(row["팀명"] ?? "").trim(),
    title: String(row["타이틀"] ?? "").trim(),
    esg: Number(row["ESG Impact"] ?? 0) || 0,
    innovation: Number(row["Innovation"] ?? 0) || 0,
    implementation: Number(row["Implementation"] ?? 0) || 0,
    total: Number(row["총득표"] ?? 0) || 0,
  };
}

function sortTeams(list) {
  return [...list].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.teamName.localeCompare(b.teamName, "ko");
  });
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getKey(team) {
  return `${team.teamName}__${team.title}`;
}

function getRankDeltaText(prevIndex, currentIndex) {
  if (prevIndex === -1) return "NEW";
  const delta = prevIndex - currentIndex;
  if (delta > 0) return `▲ ${delta}`;
  if (delta < 0) return `▼ ${Math.abs(delta)}`;
  return "–";
}

function getProgressPercent(total, maxTotal) {
  if (maxTotal <= 0) return 0;
  return Math.max(6, (total / maxTotal) * 100);
}

function updateHeroStats(teams) {
  teamCountEl.textContent = String(teams.length);
  topScoreEl.textContent = String(teams[0]?.total ?? 0);
  lastUpdatedEl.textContent = formatTime(new Date());
}

function animateCount(el, from, to, duration = 900) {
  if (from === to) {
    el.textContent = String(to);
    return;
  }

  const start = performance.now();

  function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(from + (to - from) * eased);
    el.textContent = String(value);

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = String(to);
    }
  }

  requestAnimationFrame(tick);
}

function createCard(team, index, maxTotal, previousIndex) {
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector(".team-card");

  const rank = index + 1;
  const key = getKey(team);
  const previousScore = previousScores.get(key) ?? 0;

  card.dataset.key = key;
  card.classList.add(`rank-${Math.min(rank, 3)}`);

  if (previousIndex === -1) {
    card.classList.add("new-entry");
  } else if (previousIndex > index) {
    card.classList.add("rank-rise");
  }

  const rankBadge = fragment.querySelector(".rank-badge");
  const rankDelta = fragment.querySelector(".rank-delta");
  const teamName = fragment.querySelector(".team-name");
  const teamTitle = fragment.querySelector(".team-title");
  const fieldEsg = fragment.querySelector(".field-esg");
  const fieldInnovation = fragment.querySelector(".field-innovation");
  const fieldImplementation = fragment.querySelector(".field-implementation");
  const progressBar = fragment.querySelector(".progress-bar");
  const progressGlow = fragment.querySelector(".progress-glow");
  const scoreNumber = fragment.querySelector(".score-number");

  rankBadge.textContent = String(rank);

  const deltaText = getRankDeltaText(previousIndex, index);
  rankDelta.textContent = deltaText;

  if (deltaText.startsWith("▲")) {
    card.classList.add("rank-up");
  } else if (deltaText.startsWith("▼")) {
    card.classList.add("rank-down");
  }

  teamName.textContent = team.teamName;
  teamTitle.textContent = team.title || "타이틀 없음";
  fieldEsg.textContent = String(team.esg);
  fieldInnovation.textContent = String(team.innovation);
  fieldImplementation.textContent = String(team.implementation);

  const progress = getProgressPercent(team.total, maxTotal);
  progressBar.style.width = `${progress}%`;
  progressGlow.style.width = `${progress}%`;

  scoreNumber.textContent = String(previousScore);
  requestAnimationFrame(() => {
    animateCount(scoreNumber, previousScore, team.total, 950);
  });

  return card;
}

function runFLIP() {
  const cards = Array.from(leaderboardEl.children);
  const firstRects = new Map();

  cards.forEach(card => {
    firstRects.set(card.dataset.key, card.getBoundingClientRect());
  });

  cards.forEach(card => leaderboardEl.appendChild(card));

  cards.forEach(card => {
    const first = firstRects.get(card.dataset.key);
    const last = card.getBoundingClientRect();
    const deltaY = first.top - last.top;

    if (Math.abs(deltaY) > 1) {
      card.style.transition = "none";
      card.style.transform = `translateY(${deltaY}px)`;

      requestAnimationFrame(() => {
        card.style.transition = "transform 700ms cubic-bezier(.2,.8,.2,1), box-shadow 280ms ease, border-color 280ms ease, background 280ms ease, opacity 300ms ease";
        card.style.transform = "";
      });
    }
  });
}

function renderLeaderboard(teams) {
  updateHeroStats(teams);

  if (!teams.length) {
    leaderboardEl.innerHTML = "";
    emptyStateEl.style.display = "block";
    return;
  }

  emptyStateEl.style.display = "none";

  const maxTotal = Math.max(...teams.map(t => t.total), 1);
  const currentKeys = teams.map(getKey);
  const existingCards = new Map(
    Array.from(leaderboardEl.children).map(card => [card.dataset.key, card])
  );

  const nextCards = [];

  teams.forEach((team, index) => {
    const key = getKey(team);
    const prevIndex = previousOrder.indexOf(key);
    const oldCard = existingCards.get(key);

    if (oldCard) {
      const newCard = createCard(team, index, maxTotal, prevIndex);
      oldCard.replaceWith(newCard);
      nextCards.push(newCard);
    } else {
      const card = createCard(team, index, maxTotal, prevIndex);
      nextCards.push(card);
    }
  });

  leaderboardEl.innerHTML = "";
  nextCards.forEach(card => leaderboardEl.appendChild(card));

  runFLIP();

  previousOrder = currentKeys;
  previousScores = new Map(teams.map(team => [getKey(team), team.total]));
}

async function fetchData() {
  if (isFetching) return;
  isFetching = true;

  try {
    const res = await fetch(API_URL, {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const raw = await res.json();
    const list = Array.isArray(raw) ? raw.map(normalizeTeam) : [];
    const filtered = list.filter(item => item.teamName);
    const sorted = sortTeams(filtered);

    renderLeaderboard(sorted);
  } catch (error) {
    console.error("리더보드 데이터 불러오기 실패:", error);
  } finally {
    isFetching = false;
  }
}

function startPolling() {
  fetchData();
  pollingTimer = setInterval(fetchData, POLL_INTERVAL);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  } else {
    if (!pollingTimer) {
      startPolling();
    }
  }
});

startPolling();