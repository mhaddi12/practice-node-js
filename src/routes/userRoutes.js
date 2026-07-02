const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { formatUser } = require('../controllers/authController');

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Protected, authenticated user routes
 */

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get the currently authenticated user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user
 *       401:
 *         description: Missing or invalid access token
 */
router.get('/me', authenticate, (req, res) => {
  res.status(200).json({ user: formatUser(req.user) });
});

/**
 * @swagger
 * /api/users/admin-only:
 *   get:
 *     summary: Example route only reachable by users with the admin role
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Welcome message for admins
 *       401:
 *         description: Missing or invalid access token
 *       403:
 *         description: Authenticated but not an admin
 */
router.get('/admin-only', authenticate, authorize('admin'), (req, res) => {
  res.status(200).json({ message: `Welcome, admin ${req.user.username}` });
});

module.exports = router;
