const jwt = require('jsonwebtoken');

/**
 * Generate a signed JWT for a user
 * @param {string} id  - MongoDB user _id
 * @param {string} role - user | worker | admin
 */
const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });

module.exports = generateToken;