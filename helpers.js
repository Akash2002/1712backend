const constants = require("./constants.js");

const {
  initializeApp,
  applicationDefault,
  cert,
} = require("firebase-admin/app");
const {
  getFirestore,
  Timestamp,
  FieldValue,
} = require("firebase-admin/firestore");
const serviceAccount = require("./project-3765083428805952916-25eae972655b.json");

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

function getHistory() {
  const dbRef = db.collection("history");
  return new Promise((resolve, reject) => {
    const ret = [];
    dbRef.get().then((snapshot) => {
      snapshot.forEach((matchSnapshot) => {
        if (matchSnapshot.id !== "metadata") {
          ret.push(matchSnapshot.data());
        }
      });
      console.log(ret);
      resolve(ret);
    });
  });
}

async function getPlayersAndRankings() {
  let players = {};
  const calculateRank = (elo) => {
    let rankDict = constants.RANK;
    for (const [key, value] of Object.entries(rankDict)) {
      if (elo <= key) {
        return value;
      }
    }
    return constants.MAX_RANK;
  };

  const initializePlayer = (player, playersDict, isWinner) => {
    playersDict[player] = {
      wins: isWinner ? 1 : 0,
      losses: isWinner ? 0 : 1,
      elo: 1850,
      rank: calculateRank(1850),
      history: [],
      progression: [],
      recent_results: [],
    };
    return playersDict;
  };

  const calculateWinElo = (winnerElo, loserElo) => {
    let kFactor = 0;
    if (winnerElo < 2100) {
      kFactor = 64;
    } else if (winnerElo >= 2100 && winnerElo <= 2400) {
      kFactor = 48;
    } else {
      kFactor = 32;
    }
    let factor = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
    return winnerElo + kFactor * (1 - factor);
  };

  const calculateLossElo = (winnerElo, loserElo) => {
    let kFactor = 0;
    if (loserElo < 2100) {
      kFactor = 64;
    } else if (loserElo >= 2100 && loserElo <= 2400) {
      kFactor = 48;
    } else {
      kFactor = 32;
    }
    let factor = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));
    return loserElo + kFactor * (0 - factor);
  };

  return new Promise((resolve, reject) => {
    getHistory().then((matchHistory) => {
      for (let match of matchHistory) {
        let winner = match.winner;
        let loser = match.loser;

        let wins = 0;
        let winnerRank = "";
        let winnerElo = 0;
        let winnerHistory = [];
        let winnerResults = [];
        let winnerProgression = [];

        let losses = 0;
        let loserRank = "";
        let loserElo = 0;
        let loserHistory = [];
        let loserResults = [];
        let loserProgression = [];

        if (winner in players) {
          let loserElo = 1850;
          if (loser in players) {
            loserElo = players[loser].elo;
          }
          playerElo = calculateWinElo(players[winner].elo, loserElo);
          wins = players[winner].wins + 1;
          winnerRank = calculateRank(playerElo);
          winnerElo = playerElo;
          winnerHistory = players[winner].history.concat([loser]);
          winnerResults = players[winner].recent_results;
          winnerProgression = players[winner].progression.concat([winnerElo]);
          if (winnerResults.length === constants.RECENTS_SIZE) {
            winnerResults.shift();
          }
          winnerResults.push("W");
        } else {
          players = initializePlayer(winner, players, true);
          if (loser in players) {
            winnerElo = calculateWinElo(
              constants.STARTING_ELO,
              players[loser].elo
            );
          } else {
            winnerElo = calculateWinElo(
              constants.STARTING_ELO,
              constants.STARTING_ELO
            );
          }
          wins = 1;
          winnerRank = calculateRank(winnerElo);
          winnerHistory = [loser];
          winnerResults = ["W"];
          winnerProgression = [winnerElo];
        }

        if (loser in players) {
          let winnerElo = 1850;
          if (winner in players) {
            winnerElo = players[winner].elo;
          }
          playerElo = calculateLossElo(winnerElo, players[loser].elo);
          losses = players[loser].losses + 1;
          loserRank = calculateRank(playerElo);
          loserElo = playerElo;
          loserHistory = players[loser].history.concat([winner]);
          loserProgression = players[loser].progression.concat([loserElo]);
          loserResults = players[loser].recent_results;
          if (loserResults.length === constants.RECENTS_SIZE) {
            loserResults.shift();
          }
          loserResults.push("L");
          console.log(loser + " " + loserResults);
        } else {
          players = initializePlayer(loser, players, false);
          players[loser].history.push(winner);
          if (winner in players) {
            loserElo = calculateLossElo(
              players[winner].elo,
              constants.STARTING_ELO
            );
          } else {
            loserElo = calculateLossElo(
              constants.STARTING_ELO,
              constants.STARTING_ELO
            );
          }
          losses = 1;
          loserRank = calculateRank(loserElo);
          loserHistory = [winner];
          loserResults = ["L"];
          loserProgression = [loserElo];
        }

        players[winner].wins = wins;
        players[winner].elo = winnerElo;
        players[winner].rank = winnerRank;
        players[winner].history = winnerHistory;
        players[winner].recent_results = winnerResults;
        players[winner].progression = winnerProgression;

        players[loser].losses = losses;
        players[loser].elo = loserElo;
        players[loser].rank = loserRank;
        players[loser].history = loserHistory;
        players[loser].recent_results = loserResults;
        players[loser].progression = loserProgression;
      }
      resolve(players);
    });
  });
}

function getPlayer(playerName) {
  return new Promise((resolve, reject) => {
    getHistory().then((matchHistory) => {
      getPlayersAndRankings(matchHistory).then((players) => {
        resolve(players[playerName]);
      });
    });
  });
}

function getRecentGames() {
  return new Promise((resolve, reject) => {
    getHistory().then((matchHistory) => {
      resolve(matchHistory.slice(matchHistory.length - 5, matchHistory.length));
    });
  });
}

function recordGame(winner, loser) {
  const dbRef = db.collection("history").doc("metadata");
  return new Promise((resolve, reject) => {
    dbRef.get().then((doc) => {
      if (!doc.exists) {
        reject("Document requested does not exist");
      } else {
        let data = doc.data();
        const size = data["size"];
        db.collection("history")
          .doc((size + 1).toString())
          .set({ winner: winner, loser: loser });
        dbRef.update({ size: size + 1 });
        resolve("Done");
      }
    });
  });
}

module.exports = {
  getHistory,
  getPlayersAndRankings,
  getPlayer,
  getRecentGames,
  recordGame,
};
