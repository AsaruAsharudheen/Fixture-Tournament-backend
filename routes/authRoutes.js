// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// NOTE: In a real app, use bcrypt to compare stored passwords, not plain strings
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        // Create a token that expires after 1 hour
        const token = jwt.sign({ isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '1h' });
        
        return res.json({ token });
    } else {
        return res.status(401).json({ message: 'Invalid credentials' });
    }
});

module.exports = router;