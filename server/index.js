const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());

const PORT = 3000;
const STEAM_API_KEY = process.env.STEAM_API_KEY;

// Resolve vanity → steamid
app.get("/resolve", async (req, res) => {
  try {
    const vanity = req.query.vanity;

    const response = await axios.get(
      "https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/",
      {
        params: {
          key: STEAM_API_KEY,
          vanityurl: vanity
        }
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
          include_appinfo: true
        }
      }
    );

    res.json(response.data.response.games || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch games" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});