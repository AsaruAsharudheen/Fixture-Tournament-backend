const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  id: String,
  round: String,
  match_num: Number,
  teamA_id: String,
  teamB_id: String,
  scoreA: { type: Number, default: null },
  scoreB: { type: Number, default: null },
  winner_id: { type: String, default: null },
});

const TeamSchema = new mongoose.Schema({
  id: String,
  name: String,
});

const TournamentSchema = new mongoose.Schema({
  id: { type: String, default: 'main_bracket', unique: true },
  teams: [TeamSchema],
  matches: [MatchSchema],
});

module.exports = mongoose.model('Tournament', TournamentSchema);
