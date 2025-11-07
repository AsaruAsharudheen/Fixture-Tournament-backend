const express = require('express');
const router = express.Router();
const Tournament = require('../Models/TournamentModel');
const auth = require('../middleware/authMiddleware');

const MAIN_BRACKET_ID = 'main_bracket';

// 📡 GET: Public — Fetch the tournament data
router.get('/', async (req, res) => {
  try {
    const data = await Tournament.findOne({ id: MAIN_BRACKET_ID });
    res.json(data || { teams: [], matches: [] });
  } catch (err) {
    console.error('GET /api/tournament error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// 🔐 POST: Admin — Update or create tournament safely
router.post('/', auth, async (req, res) => {
  try {
    const { teams, matches } = req.body;

    // Validate structure
    if (teams && !Array.isArray(teams))
      return res.status(400).json({ message: 'Invalid teams format' });
    if (matches && !Array.isArray(matches))
      return res.status(400).json({ message: 'Invalid matches format' });

    // Fetch or initialize base document
    let tournament = await Tournament.findOne({ id: MAIN_BRACKET_ID });

    if (!tournament) {
      tournament = new Tournament({
        id: MAIN_BRACKET_ID,
        teams: teams || [],
        matches: matches || [],
      });
    } else {
      if (teams) tournament.teams = teams;
      if (matches) tournament.matches = matches;
    }

    const saved = await tournament.save();
    res.json(saved);
  } catch (err) {
    console.error('POST /api/tournament error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
