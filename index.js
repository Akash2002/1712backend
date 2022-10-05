const express = require("express");
const helpers = require("./helpers.js");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Listening to port 3000");
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

app.get("/playersAndRankings", (_, res) => {
  helpers.getPlayersAndRankings().then((val) => {
    console.log(val);
    res.json(val);
  });
});

app.post("/player", (req, res) => {
  const input = req.body.name;
  helpers.getPlayer(input).then((val) => {
    console.log(val);
    res.json(val);
  });
});

app.get("/recentMatches", (req, res) => {
  helpers.getRecentGames().then((val) => {
    console.log(val);
    res.json(val);
  });
});

app.post("/recordMatch", (req, res) => {
  let winner = req.body.winner;
  let loser = req.body.loser;
  helpers.recordGame(winner, loser).then((val) => {
    console.log(val);
    res.json(val);
  });
});
