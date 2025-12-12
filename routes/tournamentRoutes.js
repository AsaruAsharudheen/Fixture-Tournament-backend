// routes/tournamentRoutes.js
const express = require('express');
const router = express.Router();
const Tournament = require('../Models/TournamentModel');
const auth = require('../middleware/authMiddleware');
const crypto = require('crypto');

// ID generator (no ESM issues)
const uuid = () => crypto.randomUUID();

// ------------------------------
// Utility Functions
// ------------------------------
function resetTeamStats(tournament) {
  ['A', 'B'].forEach(g => {
    tournament.groups[g].forEach(t => {
      t.points = 0;
      t.goals_for = 0;
      t.goals_against = 0;
      t.goal_diff = 0;
    });
  });
}

function findTeam(tournament, id) {
  return [...tournament.groups.A, ...tournament.groups.B].find(
    t => t.id === id
  );
}

function recomputeStandings(tournament) {
  resetTeamStats(tournament);

  tournament.matches.forEach(m => {
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

    if (m.scoreA > m.scoreB) {
      A.points += 2;
      m.winner_id = A.id;
    } else if (m.scoreB > m.scoreA) {
      B.points += 2;
      m.winner_id = B.id;
    } else {
      A.points += 1;
      B.points += 1;
      m.winner_id = null;
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

// ------------------------------
// GET tournament
// ------------------------------
router.get('/', async (req, res) => {
  try {
    let tournament = await Tournament.findOne({ id: 'main_bracket' });

    if (!tournament) {
      return res.json({
        groups: { A: [], B: [] },
        matches: [],
      });
    }

    res.json(tournament);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ------------------------------
// Generate Groups + Matches
// ------------------------------
router.post('/generate', auth, async (req, res) => {
  try {
    const teams = req.body.teams;

    if (!Array.isArray(teams) || teams.length !== 8)
      return res.status(400).json({ message: 'Send exactly 8 teams' });

    let tournament = await Tournament.findOne({ id: 'main_bracket' });
    if (!tournament) tournament = new Tournament({ id: 'main_bracket' });

    tournament.groups.A = teams.slice(0, 4).map(t => ({
      id: t.id || uuid(),
      name: t.name,
      group: 'A',
      points: 0,
      goals_for: 0,
      goals_against: 0,
      goal_diff: 0,
    }));

    tournament.groups.B = teams.slice(4, 8).map(t => ({
      id: t.id || uuid(),
      name: t.name,
      group: 'B',
      points: 0,
      goals_for: 0,
      goals_against: 0,
      goal_diff: 0,
    }));

    const roundRobin = (teams, label) => {
      const matches = [];
      let matchNum = 1;
      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          matches.push({
            id: uuid(),
            group: label,
            round: 'GROUP',
            match_num: matchNum++,
            teamA_id: teams[i].id,
            teamB_id: teams[j].id,
            scoreA: null,
            scoreB: null,
            winner_id: null,
          });
        }
      }
      return matches;
    };

    tournament.matches = [
      ...roundRobin(tournament.groups.A, 'A'),
      ...roundRobin(tournament.groups.B, 'B'),
    ];

    resetTeamStats(tournament);

    const saved = await tournament.save();
    res.json({ message: 'Generated successfully', tournament: saved });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ------------------------------
// Update Match
// ------------------------------
router.post('/update-match', auth, async (req, res) => {
  try {
    const { matchId, scoreA, scoreB } = req.body;

    const tournament = await Tournament.findOne({ id: 'main_bracket' });
    if (!tournament) return res.status(404).json({ message: 'Not found' });

    const match = tournament.matches.find(m => m.id === matchId);
    if (!match) return res.status(404).json({ message: 'Match not found' });

    match.scoreA = scoreA;
    match.scoreB = scoreB;

    recomputeStandings(tournament);

    await tournament.save();

    res.json({ message: 'Match updated', tournament });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ------------------------------
// Generate Semifinals
// ------------------------------
router.post('/generate-semifinals', auth, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ id: 'main_bracket' });

    recomputeStandings(tournament);

    const A = sortTeams([...tournament.groups.A]);
    const B = sortTeams([...tournament.groups.B]);

    const A1 = A[0],
      A2 = A[1];
    const B1 = B[0],
      B2 = B[1];

    const semi1 = {
      id: uuid(),
      group: 'SEMIS',
      round: 'SEMI',
      match_num: 1,
      teamA_id: A1.id,
      teamB_id: B2.id,
      scoreA: null,
      scoreB: null,
      winner_id: null,
    };

    const semi2 = {
      id: uuid(),
      group: 'SEMIS',
      round: 'SEMI',
      match_num: 2,
      teamA_id: B1.id,
      teamB_id: A2.id,
      scoreA: null,
      scoreB: null,
      winner_id: null,
    };

    // remove old semis
    tournament.matches = tournament.matches.filter(m => m.group !== 'SEMIS');
    tournament.matches.push(semi1, semi2);

    await tournament.save();
    res.json({ message: 'Semifinals created', semifinals: [semi1, semi2] });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ------------------------------
// Generate Final
// ------------------------------
router.post('/generate-final', auth, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ id: 'main_bracket' });

    const semis = tournament.matches.filter(m => m.group === 'SEMIS');

    semis.forEach(m => {
      if (m.scoreA > m.scoreB) m.winner_id = m.teamA_id;
      else if (m.scoreB > m.scoreA) m.winner_id = m.teamB_id;
    });

    const winners = semis.map(s => s.winner_id).filter(Boolean);
    if (winners.length !== 2)
      return res
        .status(400)
        .json({ message: 'Both semifinals must have winners' });

    const finalMatch = {
      id: uuid(),
      group: 'FINAL',
      round: 'FINAL',
      match_num: 1,
      teamA_id: winners[0],
      teamB_id: winners[1],
      scoreA: null,
      scoreB: null,
      winner_id: null,
    };

    tournament.matches = tournament.matches.filter(m => m.group !== 'FINAL');
    tournament.matches.push(finalMatch);

    await tournament.save();
    res.json({ message: 'Final created', final: finalMatch });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
