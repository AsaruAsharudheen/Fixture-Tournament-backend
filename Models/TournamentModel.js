// models/TournamentModel.js
const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  id: { type: String, required: true },       // e.g. 't1'
  name: { type: String, required: true },     // e.g. 'KACHORKAR'
  group: { type: String, enum: ['A', 'B'], required: true },
  points: { type: Number, default: 0 },
  goals_for: { type: Number, default: 0 },
  goals_against: { type: Number, default: 0 },
  goal_diff: { type: Number, default: 0 },
});

const MatchSchema = new mongoose.Schema({
  id: { type: String, required: true }, // unique id for match
  group: { type: String, enum: ['A', 'B', 'SEMIS', 'FINAL'], default: null },
  round: { type: String, default: null },
  match_num: Number,
  teamA_id: String,
  teamB_id: String,
  scoreA: { type: Number, default: null },
  scoreB: { type: Number, default: null },
  winner_id: { type: String, default: null },
});

const TournamentSchema = new mongoose.Schema({
  id: { type: String, default: 'main_bracket', unique: true },
  groups: {
    A: { type: [TeamSchema], default: [] },
    B: { type: [TeamSchema], default: [] },
  },
  matches: { type: [MatchSchema], default: [] }, // includes group stage + knockouts (tagged by group)
});

module.exports = mongoose.model('Tournament', TournamentSchema);
