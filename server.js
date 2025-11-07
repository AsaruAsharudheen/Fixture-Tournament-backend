// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
// Allows your React app to talk to the server
app.use(cors({
    // It's a good practice to restrict CORS to only your frontend domain in production
    // e.g., origin: 'http://localhost:3000' 
})); 
// Allows parsing of JSON data in requests (req.body)
app.use(express.json()); 

// --- Database Connection ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Import Routes ---
// Assuming these files are created as outlined previously:
// 1. Authentication routes (for admin login)
const authRoutes = require('./routes/authRoutes');
// 2. Tournament data routes (for public read and admin write)
const tournamentRoutes = require('./routes/tournamentRoutes');


// --- Connect Routes to Application ---
// All requests starting with /api/auth will be handled by authRoutes
app.use('/api/auth', authRoutes);
// All requests starting with /api/tournament will be handled by tournamentRoutes
app.use('/api/tournament', tournamentRoutes);


// --- Base Route ---
app.get('/', (req, res) => {
    res.send('Tournament Backend API is Running');
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});