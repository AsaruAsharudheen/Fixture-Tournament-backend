// models/TournamentModel.js
const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
    id: String,
    round: String,
    match_num: Number,
    teamA_id: String, // Stored as team ID strings
    teamB_id: String,
    scoreA: { type: Number, default: null },
    scoreB: { type: Number, default: null },
    winner_id: { type: String, default: null },
});

const TeamSchema = new mongoose.Schema({
    id: String, // Keep the same ID format as your frontend uses
    name: String,
});

const TournamentSchema = new mongoose.Schema({
    teams: [TeamSchema],
    matches: [MatchSchema],
    // We only need one document for the entire tournament data
    id: { type: String, default: 'main_bracket', unique: true } 
});

module.exports = mongoose.model('Tournament', TournamentSchema);