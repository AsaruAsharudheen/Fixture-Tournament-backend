const express = require("express");
const router = express.Router();
const Tournament = require("../Models/TournamentModel");
const auth = require("../middleware/authMiddleware");
const crypto = require("crypto");

const uuid = () => crypto.randomUUID();

// -------------------------------------------
// RESET TEAM STATS
// -------------------------------------------
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

// -------------------------------------------
// GET TOURNAMENT
// -------------------------------------------
router.get("/", async (req, res) => {
  let tournament = await Tournament.findOne({ id: "main_bracket" });
  if (!tournament)
    return res.json({ groups: { A: [], B: [] }, matches: [] });

  res.json(tournament);
});

// -------------------------------------------
// GENERATE GROUPS (6 TEAMS → 3 & 3)
// -------------------------------------------
router.post("/generate", auth, async (req, res) => {
  const teams = req.body.teams;
  if (!Array.isArray(teams) || teams.length !== 6)
    return res.status(400).json({ message: "Need EXACTLY 6 teams" });

  let tournament = await Tournament.findOne({ id: "main_bracket" });
  if (!tournament) tournament = new Tournament({ id: "main_bracket" });

  // SPLIT GROUP A – 3 teams
  tournament.groups.A = teams.slice(0, 3).map((t) => ({
    id: t.id || uuid(),
    name: t.name,
    group: "A",
    points: 0,
    goals_for: 0,
    goals_against: 0,
    goal_diff: 0,
  }));

  // SPLIT GROUP B – 3 teams
  tournament.groups.B = teams.slice(3, 6).map((t) => ({
    id: t.id || uuid(),
    name: t.name,
    group: "B",
    points: 0,
    goals_for: 0,
    goals_against: 0,
    goal_diff: 0,
  }));

  // Round robin for 3 teams = 3 matches
  const RR_3 = [
    [0, 1],
    [1, 2],
    [0, 2],
  ];

  const makeGroupMatches = (group, label) =>
    RR_3.map(([a, b], index) => ({
      id: uuid(),
      group: label,
      round: "GROUP",
      match_num: index + 1,
      teamA_id: group[a].id,
      teamB_id: group[b].id,
      scoreA: null,
      scoreB: null,
      penaltyA: null,
      penaltyB: null,
      tossWinner: false,
      winner_id: null,
    }));

  const A_matches = makeGroupMatches(tournament.groups.A, "A");
  const B_matches = makeGroupMatches(tournament.groups.B, "B");

  // Alternate matches: A1, B1, A2, B2, A3, B3
  const finalMatches = [];
  for (let i = 0; i < 3; i++) {
    finalMatches.push(A_matches[i]);
    finalMatches.push(B_matches[i]);
  }

  tournament.matches = finalMatches;

  await tournament.save();
  res.json({ message: "6-Team Tournament Generated", tournament });
});

// -------------------------------------------
// UPDATE MATCH (GROUP + KNOCKOUT)
// -------------------------------------------
router.post("/update-match", auth, async (req, res) => {
  const { matchId, scoreA, scoreB, penaltyA, penaltyB } = req.body;

  const t = await Tournament.findOne({ id: "main_bracket" });
  const match = t.matches.find((m) => m.id === matchId);

  match.scoreA = scoreA;
  match.scoreB = scoreB;

  const isKnockout = match.group === "SEMIS" || match.group === "FINAL";

  if (isKnockout) {
    if (scoreA === scoreB) {
      match.penaltyA = penaltyA ?? null;
      match.penaltyB = penaltyB ?? null;

      if (match.penaltyA == null || match.penaltyB == null) {
        return res.json({
          message: "Enter penalty scores",
          requirePenalties: true,
          match,
        });
      }

      if (match.penaltyA === match.penaltyB) {
        match.winner_id = Math.random() < 0.5 ? match.teamA_id : match.teamB_id;
        match.tossWinner = true;
      } else {
        match.winner_id =
          match.penaltyA > match.penaltyB ? match.teamA_id : match.teamB_id;
      }
    } else {
      match.winner_id = scoreA > scoreB ? match.teamA_id : match.teamB_id;
    }

    await t.save();
    return res.json({ message: "Knockout match updated", match });
  }

  // GROUP MATCH → Recompute
  recomputeStandings(t);
  await t.save();

  res.json({ message: "Group match updated", tournament: t });
});

// -------------------------------------------
// SEMIFINALS (TOP 2 FROM EACH GROUP)
// -------------------------------------------
router.post("/generate-semifinals", auth, async (req, res) => {
  const t = await Tournament.findOne({ id: "main_bracket" });

  recomputeStandings(t);

  const A = sortTeams([...t.groups.A]); // A1, A2, A3
  const B = sortTeams([...t.groups.B]); // B1, B2, B3

  const semi1 = {
    id: uuid(),
    group: "SEMIS",
    round: "SEMI",
    match_num: 1,
    teamA_id: A[0].id, // A1
    teamB_id: B[1].id, // B2
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
    teamA_id: B[0].id, // B1
    teamB_id: A[1].id, // A2
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
  res.json({ message: "Semifinals created", semis: [semi1, semi2] });
});

// -------------------------------------------
// FINAL (WINNERS OF SEMIS)
// -------------------------------------------
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
