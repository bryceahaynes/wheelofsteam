let games = [];
let gridReady = false;
let loadedImageUrls = [];

const API =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "";

const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");

let angle = 0;
let spinning = false;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function setSpin(enabled) {
  const spinBtn = document.getElementById("spinBtn");
  const loadBtn = document.getElementById("loadBtn");

  spinBtn.disabled      = !enabled;
  spinBtn.style.opacity = enabled ? "1" : "0.4";
  spinBtn.style.cursor  = enabled ? "pointer" : "not-allowed";

  // Load button mirrors spin — but stays enabled on initial page load
  // (when no games are loaded yet, spinning is impossible anyway)
  const noGamesYet = games.length === 0;
  loadBtn.disabled      = !enabled && !noGamesYet;
  loadBtn.style.opacity = (!enabled && !noGamesYet) ? "0.4" : "1";
  loadBtn.style.cursor  = (!enabled && !noGamesYet) ? "not-allowed" : "pointer";
}

// ── Image helpers ──────────────────────────────────────────────
function headerUrl(appid) {
  return `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

function allGameImageUrls(appid) {
  return [
    `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/capsule_616x353.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/page_bg_generated_v6b.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/capsule_231x87.jpg`,
  ];
}

function tryLoad(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => resolve(url);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Preload all header images for the collection
async function preloadCollectionImages(gameList) {
  const results = await Promise.all(
    gameList.map(g => tryLoad(headerUrl(g.appid)))
  );
  return results.filter(Boolean);
}

// Fetch just the header image for the winner
async function fetchWinnerImages(appid) {
  const url = headerUrl(appid);
  const result = await tryLoad(url);
  return result ? [result] : [];
}

// ── Grid helpers ───────────────────────────────────────────────
function buildTrack(urls) {
  // Repeat until we have enough tiles to fill the screen at ~180px wide with wrapping
  const tilesNeeded = Math.ceil((window.innerWidth / 186) * Math.ceil((window.innerHeight * 2.5) / 90));
  const repeated = [];
  while (repeated.length < tilesNeeded) repeated.push(...urls.sort(() => Math.random() - 0.5));
  const imgs = repeated.map(url => `<img src="${url}" alt="">`).join("");
  return `<div class="grid-track">${imgs}${imgs}</div>`;
}

// ── Background states ──────────────────────────────────────────
// Two grid layers: A = collection, B = winner. Cross-fade between them.

function bgBlank() {
  ['bg-grid-a', 'bg-grid-b'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove("active");
    el.innerHTML = "";
  });
  gridReady = false;
  setSpin(false);
}

async function bgShowCollection(imageUrls) {
  const gridA = document.getElementById("bg-grid-a");
  gridA.innerHTML = buildTrack(imageUrls);
  await sleep(50);
  gridA.classList.add("active");
}

async function bgFadeToWinner(appid) {
  const winnerUrls = await fetchWinnerImages(appid);
  if (!winnerUrls.length) return;

  const gridB = document.getElementById("bg-grid-b");
  gridB.innerHTML = buildTrack(winnerUrls);
  gridB.classList.add("active");
}

function bgResetToCollection() {
  const gridB = document.getElementById("bg-grid-b");
  gridB.classList.remove("active");
  gridB.innerHTML = "";
  document.getElementById("bg-grid-a").classList.add("active");
}

// ── Vanity extraction ──────────────────────────────────────────
function extractVanity(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "id") return parts[1];
    if (parts[0] === "profiles") return parts[1];
  } catch (e) {}
  return null;
}

// ── Load games ─────────────────────────────────────────────────
async function load() {
  const input = document.getElementById("profile").value.trim();
  const vanity = extractVanity(input);
  if (!vanity) return alert("Invalid Steam profile URL");

  let steamid = vanity;
  bgBlank();
  document.getElementById("result").textContent = "";
  document.getElementById("currentGame").textContent = "—";

  try {
    document.getElementById("result").textContent = "Fetching library...";

    if (!/^\d+$/.test(vanity)) {
      const res = await fetch(`${API}/resolve?vanity=${vanity}`);
      const data = await res.json();
      if (!data.steamid) {
        document.getElementById("result").textContent = "Could not resolve Steam profile.";
        return;
      }
      steamid = data.steamid;
    }

    const res = await fetch(`${API}/games/${steamid}`);
    games = await res.json();

    if (!Array.isArray(games) || games.length === 0) {
      document.getElementById("result").textContent = "No games found. Make sure the profile is public.";
      return;
    }

    if (games.length > 150) {
      games = games.sort((a, b) => b.playtime_forever - a.playtime_forever).slice(0, 150);
    }

    document.getElementById("result").textContent = "Loading game art...";
    angle = 0;
    drawWheel();

    loadedImageUrls = await preloadCollectionImages(games);

    if (loadedImageUrls.length === 0) {
      document.getElementById("result").textContent = `${games.length} games loaded — hit Spin.`;
      setSpin(true);
      gridReady = true;
      return;
    }

    await bgShowCollection(loadedImageUrls);
    await sleep(1000);

    gridReady = true;
    document.getElementById("result").textContent = `${games.length} games loaded — hit Spin.`;
    setSpin(true);

  } catch (err) {
    console.error(err);
    document.getElementById("result").textContent = "Error loading games.";
    setSpin(false);
  }
}

// ── Wheel drawing ──────────────────────────────────────────────
function drawWheel() {
  const num = games.length;
  if (!num) return;
  const arc = (2 * Math.PI) / num;
  ctx.clearRect(0, 0, 500, 500);
  for (let i = 0; i < num; i++) {
    const start = i * arc;
    ctx.beginPath();
    ctx.fillStyle = i % 2 ? "#1e293b" : "#334155";
    ctx.moveTo(250, 250);
    ctx.arc(250, 250, 250, start, start + arc);
    ctx.fill();
    if (arc > 0.05) {
      ctx.save();
      ctx.translate(250, 250);
      ctx.rotate(start + arc / 2);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "12px Arial";
      ctx.fillText(games[i].name.slice(0, 18), 120, 5);
      ctx.restore();
    }
  }
}

function drawRotatedWheel() {
  ctx.save();
  ctx.clearRect(0, 0, 500, 500);
  ctx.translate(250, 250);
  ctx.rotate(angle);
  ctx.translate(-250, -250);
  drawWheel();
  ctx.restore();
}

// ── Spin ───────────────────────────────────────────────────────
function spin() {
  if (!games.length || spinning || !gridReady) return;
  spinning = true;
  setSpin(false);
  document.getElementById("result").textContent = "";
  bgResetToCollection();

  let velocity = Math.random() * 0.6 + 0.9;
  const friction = 0.992;
  let fadedOut = false;

  function animate() {
    velocity *= friction;
    angle += velocity;
    drawRotatedWheel();
    updateCurrent();

    // Fade collection out as wheel slows below threshold
    if (!fadedOut && velocity < 0.35) {
      fadedOut = true;
      document.getElementById("bg-grid-a").classList.remove("active");
    }

    if (velocity > 0.002) {
      requestAnimationFrame(animate);
    } else {
      spinning = false;
      setSpin(true);
      pickWinner();
    }
  }
  requestAnimationFrame(animate);
}

function updateCurrent() {
  const num = games.length;
  const degrees = ((angle * 180) / Math.PI) % 360;
  const slice = 360 / num;
  const index = Math.floor((360 - degrees) / slice) % num;
  document.getElementById("currentGame").textContent = games[index]?.name || "";
}

// ── Pick winner ────────────────────────────────────────────────
function pickWinner() {
  const num = games.length;
  const degrees = ((angle * 180) / Math.PI) % 360;
  const slice = 360 / num;
  const index = Math.floor((360 - degrees) / slice) % num;

  const appid   = games[index].appid;
  const name    = games[index].name;
  const minutes = games[index].playtime_forever || 0;
  const hours   = (minutes / 60).toFixed(1);
  const playtime = minutes < 60 ? `${minutes} min played` : `${hours} hrs played`;

  document.getElementById("result").innerHTML =
    `<span class="result-label">Play: </span>` +
    `<a class="result-game" href="https://store.steampowered.com/app/${appid}" target="_blank" rel="noopener">${name}</a>` +
    `<span class="result-playtime">${playtime}</span>`;

  bgFadeToWinner(appid);
}

setSpin(false);

// Click the wheel canvas to spin
document.getElementById("wheel").addEventListener("click", () => spin());

// Disable art checkbox
document.getElementById("disableArt").addEventListener("change", function() {
  const hidden = this.checked;
  document.getElementById("bg-grid-a").style.display = hidden ? "none" : "";
  document.getElementById("bg-grid-b").style.display = hidden ? "none" : "";
});