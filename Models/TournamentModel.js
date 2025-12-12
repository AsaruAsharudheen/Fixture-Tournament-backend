const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  id: String,
  group: String,
  round: String,
  match_num: Number,

  teamA_id: String,
  teamB_id: String,

  scoreA: { type: Number, default: null },
  scoreB: { type: Number, default: null },

  penaltyA: { type: Number, default: null },
  penaltyB: { type: Number, default: null },

  tossWinner: { type: Boolean, default: false },
  winner_id: { type: String, default: null },
});

const TeamSchema = new mongoose.Schema({
  id: String,
  name: String,
  group: String,
  points: Number,
  goals_for: Number,
  goals_against: Number,
  goal_diff: Number,
});

const TournamentSchema = new mongoose.Schema({
  id: { type: String, default: 'main_bracket', unique: true },
  groups: {
    A: [TeamSchema],
    B: [TeamSchema],
  },
  matches: [MatchSchema],
});

module.exports = mongoose.model('Tournament', TournamentSchema);
