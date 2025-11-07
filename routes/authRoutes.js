const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// ⚠️ For security, store credentials in .env
// ADMIN_USER=admin
// ADMIN_PASS=yourpassword
// JWT_SECRET=yourSecretKey

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    const token = jwt.sign({ isAdmin: true }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    return res.json({ token });
  } else {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
});

module.exports = router;
