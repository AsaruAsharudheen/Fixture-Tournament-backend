// routes/tournamentRoutes.js
const express = require('express');
const router = express.Router();
const Tournament = require('../Models/TournamentModel');
const auth = require('../middleware/authMiddleware'); // Import protection middleware

const MAIN_BRACKET_ID = 'main_bracket';

// @route   GET /api/tournament
// @desc    Get current tournament data (PUBLIC ACCESS)
router.get('/', async (req, res) => {
    try {
        const data = await Tournament.findOne({ id: MAIN_BRACKET_ID });
        // Return data if found, or an empty structure if not yet set up
        res.json(data || { teams: [], matches: [] }); 
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/tournament
// @desc    Initialize or Update tournament data (ADMIN ONLY)
router.post('/', auth, async (req, res) => {
    try {
        const { teams, matches } = req.body;
        
        // This handles both initial setup and score/bracket updates
        const updatedData = await Tournament.findOneAndUpdate(
            { id: MAIN_BRACKET_ID },
            { $set: { teams, matches } },
            { new: true, upsert: true } // 'upsert: true' means create if not exists
        );
        res.json(updatedData);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;