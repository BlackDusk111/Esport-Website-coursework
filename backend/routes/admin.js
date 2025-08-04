const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { logAuditEvent } = require('../middleware/validation');

// Middleware to ensure admin access
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Get system statistics
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [userStats] = await db.execute(
      'SELECT COUNT(*) as total_users, SUM(CASE WHEN last_login > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) as active_users FROM users'
    );

    const [teamStats] = await db.execute(
      'SELECT COUNT(*) as total_teams FROM teams WHERE is_active = true'
    );

    const [tournamentStats] = await db.execute(
      'SELECT COUNT(*) as total_tournaments FROM tournaments'
    );

    const [matchStats] = await db.execute(
      'SELECT COUNT(*) as total_matches, SUM(CASE WHEN status = "in_progress" AND score1 IS NOT NULL AND score2 IS NOT NULL AND verified_by_admin_id IS NULL THEN 1 ELSE 0 END) as pending_verifications FROM matches'
    );

    res.json({
      totalUsers: userStats[0].total_users,
      totalTeams: teamStats[0].total_teams,
      totalTournaments: tournamentStats[0].total_tournaments,
      totalMatches: matchStats[0].total_matches,
      activeUsers: userStats[0].active_users,
      pendingVerifications: matchStats[0].pending_verifications,
    });
  } catch (error) {
    console.error('Error fetching system stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all users with admin details
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [users] = await db.execute(`
      SELECT 
        id, username, email, role, email_verified, account_locked, 
        failed_login_count, last_login, created_at, updated_at
      FROM users 
      ORDER BY created_at DESC
    `);

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new user
router.post('/users', [
  authenticateToken,
  requireAdmin,
  body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['player', 'captain', 'admin']).withMessage('Invalid role'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, role, email_verified = false } = req.body;

    // Check if user already exists
    const [existingUsers] = await db.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create user
    const [result] = await db.execute(
      'INSERT INTO users (username, email, password_hash, role, email_verified) VALUES (?, ?, ?, ?, ?)',
      [username, email, password_hash, role, email_verified]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'create', 'users', result.insertId, null, {
      username, email, role, email_verified
    }, req.ip);

    res.status(201).json({ 
      message: 'User created successfully',
      userId: result.insertId 
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user
router.put('/users/:id', [
  authenticateToken,
  requireAdmin,
  body('username').optional().trim().isLength({ min: 3, max: 50 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('role').optional().isIn(['player', 'captain', 'admin']),
  body('email_verified').optional().isBoolean(),
  body('account_locked').optional().isBoolean(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.params.id;
    const updates = req.body;

    // Get current user data for audit log
    const [currentUser] = await db.execute(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    if (currentUser.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent admin from locking themselves out
    if (userId == req.user.id && updates.account_locked === true) {
      return res.status(400).json({ message: 'Cannot lock your own account' });
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];

    Object.keys(updates).forEach(key => {
      if (['username', 'email', 'role', 'email_verified', 'account_locked'].includes(key)) {
        updateFields.push(`${key} = ?`);
        updateValues.push(updates[key]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(userId);

    await db.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Reset failed login count if unlocking account
    if (updates.account_locked === false) {
      await db.execute(
        'UPDATE users SET failed_login_count = 0 WHERE id = ?',
        [userId]
      );
    }

    // Log audit event
    await logAuditEvent(req.user.id, 'update', 'users', userId, 
      currentUser[0], updates, req.ip);

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Lock/Unlock user account
router.put('/users/:id/lock', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent admin from locking themselves out
    if (userId == req.user.id) {
      return res.status(400).json({ message: 'Cannot lock your own account' });
    }

    const [currentUser] = await db.execute(
      'SELECT account_locked FROM users WHERE id = ?',
      [userId]
    );

    if (currentUser.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newLockStatus = !currentUser[0].account_locked;

    await db.execute(
      'UPDATE users SET account_locked = ?, failed_login_count = 0, updated_at = NOW() WHERE id = ?',
      [newLockStatus, userId]
    );

    // Log audit event
    await logAuditEvent(req.user.id, newLockStatus ? 'lock' : 'unlock', 'users', userId, 
      currentUser[0], { account_locked: newLockStatus }, req.ip);

    res.json({ 
      message: `User ${newLockStatus ? 'locked' : 'unlocked'} successfully`,
      locked: newLockStatus 
    });
  } catch (error) {
    console.error('Error toggling user lock:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete user (soft delete by deactivating)
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (userId == req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const [currentUser] = await db.execute(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    if (currentUser.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Soft delete by locking account and marking email as deleted
    await db.execute(
      'UPDATE users SET account_locked = true, email = CONCAT("deleted_", id, "_", email), updated_at = NOW() WHERE id = ?',
      [userId]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'delete', 'users', userId, 
      currentUser[0], { deleted: true }, req.ip);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get pending match verifications
router.get('/matches/pending', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [matches] = await db.execute(`
      SELECT 
        m.id, m.tournament_id, m.team1_id, m.team2_id, m.score1, m.score2,
        m.scheduled_time, m.status, m.submitted_by_user_id, m.updated_at,
        t.name as tournament_name,
        t1.name as team1_name,
        t2.name as team2_name,
        u.username as submitted_by_username
      FROM matches m
      JOIN tournaments t ON m.tournament_id = t.id
      JOIN teams t1 ON m.team1_id = t1.id
      JOIN teams t2 ON m.team2_id = t2.id
      LEFT JOIN users u ON m.submitted_by_user_id = u.id
      WHERE m.score1 IS NOT NULL 
        AND m.score2 IS NOT NULL 
        AND m.verified_by_admin_id IS NULL
        AND m.status = 'in_progress'
      ORDER BY m.updated_at ASC
    `);

    res.json(matches);
  } catch (error) {
    console.error('Error fetching pending matches:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Verify match score
router.put('/matches/:id/verify', [
  authenticateToken,
  requireAdmin,
  body('action').isIn(['approve', 'dispute']).withMessage('Action must be approve or dispute'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const matchId = req.params.id;
    const { action } = req.body;

    // Get current match data
    const [currentMatch] = await db.execute(
      'SELECT * FROM matches WHERE id = ?',
      [matchId]
    );

    if (currentMatch.length === 0) {
      return res.status(404).json({ message: 'Match not found' });
    }

    const match = currentMatch[0];

    if (match.verified_by_admin_id !== null) {
      return res.status(400).json({ message: 'Match already verified' });
    }

    let newStatus;
    if (action === 'approve') {
      newStatus = 'completed';
    } else if (action === 'dispute') {
      newStatus = 'disputed';
    }

    await db.execute(
      'UPDATE matches SET status = ?, verified_by_admin_id = ?, updated_at = NOW() WHERE id = ?',
      [newStatus, req.user.id, matchId]
    );

    // Log audit event
    await logAuditEvent(req.user.id, 'verify', 'matches', matchId, 
      match, { status: newStatus, action }, req.ip);

    res.json({ 
      message: `Match ${action}d successfully`,
      status: newStatus 
    });
  } catch (error) {
    console.error('Error verifying match:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get audit logs
router.get('/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 100, offset = 0, action } = req.query;

    let query = `
      SELECT 
        al.id, al.user_id, al.action, al.table_name, al.record_id,
        al.old_values, al.new_values, al.ip_address, al.created_at,
        u.username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
    `;

    const queryParams = [];

    if (action && action !== 'all') {
      query += ' WHERE al.action = ?';
      queryParams.push(action);
    }

    query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));

    const [logs] = await db.execute(query, queryParams);

    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get system health metrics
router.get('/health', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Database connection test
    const [dbTest] = await db.execute('SELECT 1 as test');
    
    // Recent activity metrics
    const [recentActivity] = await db.execute(`
      SELECT 
        COUNT(CASE WHEN created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 END) as last_hour,
        COUNT(CASE WHEN created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as last_day,
        COUNT(CASE WHEN created_at > DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as last_week
      FROM audit_logs
    `);

    // Failed login attempts
    const [failedLogins] = await db.execute(`
      SELECT COUNT(*) as failed_attempts
      FROM login_attempts 
      WHERE success = false 
        AND attempt_time > DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `);

    // Active sessions
    const [activeSessions] = await db.execute(`
      SELECT COUNT(*) as active_sessions
      FROM user_sessions 
      WHERE expires_at > NOW()
    `);

    res.json({
      database: dbTest.length > 0 ? 'healthy' : 'error',
      recentActivity: recentActivity[0],
      failedLogins: failedLogins[0].failed_attempts,
      activeSessions: activeSessions[0].active_sessions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching system health:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      database: 'error',
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;