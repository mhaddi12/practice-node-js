const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const authController = require('../controllers/authController');

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Registration, login, tokens, verification, and password reset
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         username: { type: string }
 *         email: { type: string }
 *         role: { type: string, enum: [user, admin] }
 *         isEmailVerified: { type: boolean }
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username: { type: string, minLength: 3, maxLength: 30 }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       201:
 *         description: User created, verification email sent
 *       400:
 *         description: Validation error
 *       409:
 *         description: Username or email already in use
 */
router.post(
  '/register',
  [
    body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  ],
  validate,
  authController.register
);

/**
 * @swagger
 * /api/auth/verify-email/{token}:
 *   get:
 *     summary: Verify a user's email using the token emailed to them
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Email verified
 *       400:
 *         description: Token invalid or expired
 */
router.get('/verify-email/:token', authController.verifyEmail);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Log in with username and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful, returns access + refresh tokens
 *       401:
 *         description: Invalid credentials
 */
router.post(
  '/login',
  [body('username').notEmpty().withMessage('Username is required'), body('password').notEmpty().withMessage('Password is required')],
  validate,
  authController.login
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Exchange a refresh token for a new access + refresh token pair
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: New token pair issued
 *       401:
 *         description: Refresh token invalid, expired, or revoked
 */
router.post('/refresh', authController.refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Revoke a refresh token
 *     tags: [Auth]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Logged out
 */
router.post('/logout', authController.logout);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request a password reset email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Reset email sent if the address is registered (response is the same either way)
 */
router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('A valid email is required').normalizeEmail()],
  validate,
  authController.forgotPassword
);

/**
 * @swagger
 * /api/auth/reset-password/{token}:
 *   post:
 *     summary: Set a new password using the token emailed to the user
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Token invalid or expired
 */
router.post(
  '/reset-password/:token',
  [body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')],
  validate,
  authController.resetPassword
);

module.exports = router;
