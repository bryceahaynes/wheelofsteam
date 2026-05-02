let games = [];

// Auto-detect API URL: localhost in dev, same origin in production
const API =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "";

const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");

let angle = 0;
let spinning = false;

function extractVanity(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "id") return parts[1];
    if (parts[0] === "profiles") return parts[1];
  } catch (e) {}
  return null;
}

async function load() {
  const input = document.getElementById("profile").value.trim();
  const vanity = extractVanity(input);

  if (!vanity) return alert("Invalid Steam profile URL");

  let steamid = vanity;

  try {
    document.getElementById("result").textContent = "Loading games...";

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
      document.getElementById("result").textContent =
        "No games found. Make sure the profile is public.";
      return;
    }

    console.log("Total games:", games.length);

    // Limit for performance — top 150 by playtime

    document.getElementById("result").textContent = `${games.length} games loaded! Hit Spin.`;
    angle = 0;
    drawWheel();
  } catch (err) {
    console.error(err);
    document.getElementById("result").textContent = "Error loading games. Check the console.";
  }
}

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

function spin() {
  if (!games.length || spinning) return;

  spinning = true;
  document.getElementById("result").textContent = "";

  let velocity = Math.random() * 0.6 + 0.9;
  let friction = 0.992;

  function animate() {
    velocity *= friction;
    angle += velocity;

    drawRotatedWheel();
    updateCurrent();

    if (velocity > 0.002) {
      requestAnimationFrame(animate);
    } else {
      spinning = false;
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

function pickWinner() {
  const num = games.length;
  const degrees = ((angle * 180) / Math.PI) % 360;
  const slice = 360 / num;
  const index = Math.floor((360 - degrees) / slice) % num;

  document.getElementById("result").textContent = "🎯 Play: " + games[index].name;
}