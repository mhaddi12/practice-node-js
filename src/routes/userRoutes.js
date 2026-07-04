const { Router } = require('express');
const { body } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { formatUser } = require('../controllers/authController');
const userController = require('../controllers/userController');

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

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: List all users except the requesting admin (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *       401:
 *         description: Missing or invalid access token
 *       403:
 *         description: Authenticated but not an admin
 */
router.get('/', authenticate, authorize('admin'), userController.listUsers);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get a single user by id (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User found
 *       404:
 *         description: User not found
 *   delete:
 *     summary: Delete a user by id (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User deleted
 *       404:
 *         description: User not found
 */
router.get('/:id', authenticate, authorize('admin'), userController.getUserById);
router.delete('/:id', authenticate, authorize('admin'), userController.deleteUser);

/**
 * @swagger
 * /api/users/{id}/role:
 *   patch:
 *     summary: Change a user's role (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [user, admin] }
 *     responses:
 *       200:
 *         description: Role updated
 *       400:
 *         description: Invalid role
 *       404:
 *         description: User not found
 */
router.patch(
  '/:id/role',
  authenticate,
  authorize('admin'),
  [body('role').isIn(['user', 'admin']).withMessage('Role must be "user" or "admin"')],
  validate,
  userController.updateUserRole
);

module.exports = router;
