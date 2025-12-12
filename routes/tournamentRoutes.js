const express = require("express");
const router = express.Router();
const Tournament = require("../Models/TournamentModel");
const auth = require("../middleware/authMiddleware");
const crypto = require("crypto");

const uuid = () => crypto.randomUUID();

// ---------------------------------------------------------
// RESET TEAM STATS
// ---------------------------------------------------------
function resetTeamStats(tournament) {
  ["A", "B"].forEach((g) => {
    tournament.groups[g].forEach((t) => {
      t.points = 0;
      t.goals_for = 0;
      t.goals_against = 0;
      t.goal_diff = 0;
    });
  });
}

function findTeam(tournament, id) {
  return [...tournament.groups.A, ...tournament.groups.B].find(
    (t) => t.id === id
  );
}

function recomputeStandings(tournament) {
  resetTeamStats(tournament);

  tournament.matches.forEach((m) => {
    if (m.scoreA == null || m.scoreB == null) return;

    const A = findTeam(tournament, m.teamA_id);
    const B = findTeam(tournament, m.teamB_id);

    if (!A || !B) return;

    A.goals_for += m.scoreA;
    A.goals_against += m.scoreB;
    A.goal_diff = A.goals_for - A.goals_against;

    B.goals_for += m.scoreB;
    B.goals_against += m.scoreA;
    B.goal_diff = B.goals_for - B.goals_against;

    if (m.scoreA > m.scoreB) A.points += 2;
    else if (m.scoreB > m.scoreA) B.points += 2;
    else {
      A.points += 1;
      B.points += 1;
    }
  });
}

function sortTeams(teams) {
  return teams.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goal_diff !== a.goal_diff) return b.goal_diff - a.goal_diff;
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
    return 0;
  });
}

// ---------------------------------------------------------
// GET TOURNAMENT
// ---------------------------------------------------------
router.get("/", async (req, res) => {
  let tournament = await Tournament.findOne({ id: "main_bracket" });
  if (!tournament)
    return res.json({ groups: { A: [], B: [] }, matches: [] });

  res.json(tournament);
});

// ---------------------------------------------------------
// GENERATE GROUPS + ALTERNATING MATCHES
// ---------------------------------------------------------
router.post("/generate", auth, async (req, res) => {
  const teams = req.body.teams;
  if (!Array.isArray(teams) || teams.length !== 8)
    return res.status(400).json({ message: "Need 8 teams" });

  let tournament = await Tournament.findOne({ id: "main_bracket" });
  if (!tournament)
    tournament = new Tournament({ id: "main_bracket" });

  // SPLIT GROUPS
  tournament.groups.A = teams.slice(0, 4).map((t) => ({
    id: t.id || uuid(),
    name: t.name,
    group: "A",
    points: 0,
    goals_for: 0,
    goals_against: 0,
    goal_diff: 0,
  }));

  tournament.groups.B = teams.slice(4, 8).map((t) => ({
    id: t.id || uuid(),
    name: t.name,
    group: "B",
    points: 0,
    goals_for: 0,
    goals_against: 0,
    goal_diff: 0,
  }));

  // CORRECT ROUND ROBIN ORDER
  const RR_ORDER = [
    [0, 1], [2, 3],
    [0, 2], [1, 3],
    [0, 3], [1, 2],
  ];

  const makeGroupMatches = (group, label) => {
    let out = [];
    let num = 1;

    RR_ORDER.forEach(([i, j]) => {
      out.push({
        id: uuid(),
        group: label,
        round: "GROUP",
        match_num: num++,
        teamA_id: group[i].id,
        teamB_id: group[j].id,
        scoreA: null,
        scoreB: null,
        penaltyA: null,
        penaltyB: null,
        tossWinner: false,
        winner_id: null,
      });
    });

    return out;
  };

  const A_matches = makeGroupMatches(tournament.groups.A, "A");
  const B_matches = makeGroupMatches(tournament.groups.B, "B");

  // ALTERNATING: A1,B1,A2,B2...
  const finalMatches = [];
  for (let i = 0; i < 6; i++) {
    finalMatches.push(A_matches[i]);
    finalMatches.push(B_matches[i]);
  }

  tournament.matches = finalMatches;

  await tournament.save();

  res.json({ message: "Groups + Matches generated", tournament });
});

// ---------------------------------------------------------
// UPDATE MATCH (GROUP + KNOCKOUT LOGIC)
// ---------------------------------------------------------
router.post("/update-match", auth, async (req, res) => {
  const { matchId, scoreA, scoreB, penaltyA, penaltyB } = req.body;

  const t = await Tournament.findOne({ id: "main_bracket" });
  const match = t.matches.find((m) => m.id === matchId);

  match.scoreA = scoreA;
  match.scoreB = scoreB;

  const isKnockout = match.group === "SEMIS" || match.group === "FINAL";

  if (isKnockout) {
    // DRAW in normal time → penalties
    if (scoreA === scoreB) {
      match.penaltyA = penaltyA ?? null;
      match.penaltyB = penaltyB ?? null;

      if (match.penaltyA == null || match.penaltyB == null) {
        return res.json({
          message: "Normal time draw → Enter penalty scores",
          requirePenalties: true,
          match,
        });
      }

      // Penalties also level → toss
      if (match.penaltyA === match.penaltyB) {
        const tossWinner = Math.random() < 0.5 ? match.teamA_id : match.teamB_id;
        match.winner_id = tossWinner;
        match.tossWinner = true;
      } else {
        match.winner_id =
          match.penaltyA > match.penaltyB ? match.teamA_id : match.teamB_id;
      }
    } else {
      // Normal time winner
      match.winner_id = scoreA > scoreB ? match.teamA_id : match.teamB_id;
    }

    await t.save();
    return res.json({ message: "Knockout match updated", match });
  }

  // GROUP LOGIC
  recomputeStandings(t);
  await t.save();
  res.json({ message: "Group match updated", tournament: t });
});

// ---------------------------------------------------------
// SEMIFINALS
// ---------------------------------------------------------
router.post("/generate-semifinals", auth, async (req, res) => {
  const t = await Tournament.findOne({ id: "main_bracket" });

  recomputeStandings(t);

  const A = sortTeams([...t.groups.A]);
  const B = sortTeams([...t.groups.B]);

  const semi1 = {
    id: uuid(),
    group: "SEMIS",
    round: "SEMI",
    match_num: 1,
    teamA_id: A[0].id,
    teamB_id: B[1].id,
    scoreA: null,
    scoreB: null,
    penaltyA: null,
    penaltyB: null,
    tossWinner: false,
    winner_id: null,
  };

  const semi2 = {
    id: uuid(),
    group: "SEMIS",
    round: "SEMI",
    match_num: 2,
    teamA_id: B[0].id,
    teamB_id: A[1].id,
    scoreA: null,
    scoreB: null,
    penaltyA: null,
    penaltyB: null,
    tossWinner: false,
    winner_id: null,
  };

  t.matches = t.matches.filter((m) => m.group !== "SEMIS");
  t.matches.push(semi1, semi2);

  await t.save();
  res.json({ message: "Semifinals created", semifinals: [semi1, semi2] });
});

// ---------------------------------------------------------
// FINAL
// ---------------------------------------------------------
router.post("/generate-final", auth, async (req, res) => {
  const t = await Tournament.findOne({ id: "main_bracket" });

  const semis = t.matches.filter((m) => m.group === "SEMIS");

  const winners = semis
    .map((m) => {
      if (m.scoreA > m.scoreB) return m.teamA_id;
      if (m.scoreB > m.scoreA) return m.teamB_id;
      if (m.penaltyA > m.penaltyB) return m.teamA_id;
      if (m.penaltyB > m.penaltyA) return m.teamB_id;
      return null;
    })
    .filter(Boolean);

  if (winners.length !== 2)
    return res.status(400).json({ message: "Semis not completed" });

  const finalMatch = {
    id: uuid(),
    group: "FINAL",
    round: "FINAL",
    match_num: 1,
    teamA_id: winners[0],
    teamB_id: winners[1],
    scoreA: null,
    scoreB: null,
    penaltyA: null,
    penaltyB: null,
    tossWinner: false,
    winner_id: null,
  };

  t.matches = t.matches.filter((m) => m.group !== "FINAL");
  t.matches.push(finalMatch);

  await t.save();
  res.json({ message: "Final created", final: finalMatch });
});

module.exports = router;
