const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const STEAM_API_KEY = process.env.STEAM_API_KEY;

// Serve static client files
app.use(express.static(path.join(__dirname, "../client")));

// Resolve vanity → steamid
app.get("/resolve", async (req, res) => {
  try {
    const vanity = req.query.vanity;

    const response = await axios.get(
      "https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/",
      {
        params: {
          key: STEAM_API_KEY,
          vanityurl: vanity,
        },
      }
    );

    res.json(response.data.response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to resolve vanity URL" });
  }
});

// Get owned games
app.get("/games/:steamid", async (req, res) => {
  try {
    const steamid = req.params.steamid;

    const response = await axios.get(
      "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/",
      {
        params: {
          key: STEAM_API_KEY,
          steamid,
          include_appinfo: true,
        },
      }
    );

    res.json(response.data.response.games || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch games" });
  }
});

// Catch-all: serve index.html for any unmatched route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});