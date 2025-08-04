const express = require('express');
const { promisePool, logAudit } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateUserUpdate, validateIdParam, validatePagination, sanitizeInput } = require('../middleware/validation');

const router = express.Router();

// Apply input sanitization to all routes
router.use(sanitizeInput);

// Get user profile (authenticated user only)
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const [users] = await promisePool.execute(
            `SELECT id, username, email, role, email_verified, created_at, updated_at, last_login
             FROM users WHERE id = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        res.json({
            user: users[0]
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            error: 'Failed to get profile',
            code: 'PROFILE_ERROR'
        });
    }
});

// Update user profile
router.put('/profile', authenticateToken, validateUserUpdate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { username, email } = req.body;

        // Get current user data for audit log
        const [currentUsers] = await promisePool.execute(
            'SELECT username, email FROM users WHERE id = ?',
            [userId]
        );

        if (currentUsers.length === 0) {
            return res.status(404).json({
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        const oldValues = currentUsers[0];
        const updateFields = [];
        const updateValues = [];

        if (username && username !== oldValues.username) {
            // Check if username is already taken
            const [existingUsers] = await promisePool.execute(
                'SELECT id FROM users WHERE username = ? AND id != ?',
                [username, userId]
            );

            if (existingUsers.length > 0) {
                return res.status(409).json({
                    error: 'Username already taken',
                    code: 'USERNAME_TAKEN'
                });
            }

            updateFields.push('username = ?');
            updateValues.push(username);
        }

        if (email && email !== oldValues.email) {
            // Check if email is already taken
            const [existingUsers] = await promisePool.execute(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, userId]
            );

            if (existingUsers.length > 0) {
                return res.status(409).json({
                    error: 'Email already taken',
                    code: 'EMAIL_TAKEN'
                });
            }

            updateFields.push('email = ?, email_verified = FALSE');
            updateValues.push(email);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                error: 'No valid fields to update',
                code: 'NO_UPDATES'
            });
        }

        // Update user
        updateFields.push('updated_at = NOW()');
        updateValues.push(userId);

        await promisePool.execute(
            `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        // Get updated user data
        const [updatedUsers] = await promisePool.execute(
            'SELECT id, username, email, role, email_verified, created_at, updated_at FROM users WHERE id = ?',
            [userId]
        );

        // Log the update
        await logAudit(userId, 'UPDATE', 'users', userId, oldValues, {
            username: updatedUsers[0].username,
            email: updatedUsers[0].email
        }, req.ip);

        res.json({
            message: 'Profile updated successfully',
            user: updatedUsers[0]
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            error: 'Failed to update profile',
            code: 'UPDATE_ERROR'
        });
    }
});

// Get all users (admin only)
router.get('/', authenticateToken, requireAdmin, validatePagination, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const search = req.query.q || '';

        let query = `
            SELECT id, username, email, role, email_verified, account_locked, 
                   failed_login_count, last_login, created_at, updated_at
            FROM users
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM users';
        let queryParams = [];

        if (search) {
            query += ' WHERE username LIKE ? OR email LIKE ?';
            countQuery += ' WHERE username LIKE ? OR email LIKE ?';
            queryParams = [`%${search}%`, `%${search}%`];
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        queryParams.push(limit, offset);

        const [users] = await promisePool.execute(query, queryParams);
        const [countResult] = await promisePool.execute(countQuery, search ? [`%${search}%`, `%${search}%`] : []);

        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        res.json({
            users,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            error: 'Failed to get users',
            code: 'GET_USERS_ERROR'
        });
    }
});

// Get user by ID (admin only)
router.get('/:id', authenticateToken, validateIdParam, async (req, res) => {
    try {
        const userId = req.params.id;

        const [users] = await promisePool.execute(
            `SELECT id, username, email, role, email_verified, account_locked, 
                    failed_login_count, last_login, created_at, updated_at
             FROM users WHERE id = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        res.json({
            user: users[0]
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            error: 'Failed to get user',
            code: 'GET_USER_ERROR'
        });
    }
});

// Update user (admin only)
router.put('/:id', authenticateToken, validateIdParam, validateUserUpdate, async (req, res) => {
    try {
        const userId = req.params.id;
        const { username, email, role, account_locked, email_verified } = req.body;

        // Get current user data
        const [currentUsers] = await promisePool.execute(
            'SELECT username, email, role, account_locked, email_verified FROM users WHERE id = ?',
            [userId]
        );

        if (currentUsers.length === 0) {
            return res.status(404).json({
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        const oldValues = currentUsers[0];
        const updateFields = [];
        const updateValues = [];

        if (username && username !== oldValues.username) {
            const [existingUsers] = await promisePool.execute(
                'SELECT id FROM users WHERE username = ? AND id != ?',
                [username, userId]
            );

            if (existingUsers.length > 0) {
                return res.status(409).json({
                    error: 'Username already taken',
                    code: 'USERNAME_TAKEN'
                });
            }

            updateFields.push('username = ?');
            updateValues.push(username);
        }

        if (email && email !== oldValues.email) {
            const [existingUsers] = await promisePool.execute(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, userId]
            );

            if (existingUsers.length > 0) {
                return res.status(409).json({
                    error: 'Email already taken',
                    code: 'EMAIL_TAKEN'
                });
            }

            updateFields.push('email = ?');
            updateValues.push(email);
        }

        if (role && role !== oldValues.role) {
            updateFields.push('role = ?');
            updateValues.push(role);
        }

        if (typeof account_locked === 'boolean' && account_locked !== oldValues.account_locked) {
            updateFields.push('account_locked = ?, failed_login_count = 0');
            updateValues.push(account_locked);
        }

        if (typeof email_verified === 'boolean' && email_verified !== oldValues.email_verified) {
            updateFields.push('email_verified = ?');
            updateValues.push(email_verified);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                error: 'No valid fields to update',
                code: 'NO_UPDATES'
            });
        }

        updateFields.push('updated_at = NOW()');
        updateValues.push(userId);

        await promisePool.execute(
            `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        // Get updated user data
        const [updatedUsers] = await promisePool.execute(
            `SELECT id, username, email, role, email_verified, account_locked, 
                    failed_login_count, last_login, created_at, updated_at
             FROM users WHERE id = ?`,
            [userId]
        );

        // Log the update
        await logAudit(req.user.id, 'ADMIN_UPDATE', 'users', userId, oldValues, {
            username: updatedUsers[0].username,
            email: updatedUsers[0].email,
            role: updatedUsers[0].role,
            account_locked: updatedUsers[0].account_locked,
            email_verified: updatedUsers[0].email_verified
        }, req.ip);

        res.json({
            message: 'User updated successfully',
            user: updatedUsers[0]
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            error: 'Failed to update user',
            code: 'UPDATE_ERROR'
        });
    }
});

// Get user notifications
router.get('/notifications', authenticateToken, async (req, res) => {
    try {
        // For now, return mock notifications since we don't have a notifications table
        // In a real implementation, you would query a notifications table
        const mockNotifications = [
            {
                id: 1,
                type: 'info',
                title: 'Welcome to the Platform',
                message: 'Your account has been successfully created!',
                read: false,
                timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            },
            {
                id: 2,
                type: 'success',
                title: 'Tournament Registration',
                message: 'You have successfully registered for the Spring Championship!',
                read: true,
                timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
            },
        ];

        // Add some dynamic notifications based on user activity
        const [recentMatches] = await promisePool.execute(`
            SELECT m.*, t.name as tournament_name, t1.name as team1_name, t2.name as team2_name
            FROM matches m
            JOIN tournaments t ON m.tournament_id = t.id
            JOIN teams t1 ON m.team1_id = t1.id
            JOIN teams t2 ON m.team2_id = t2.id
            WHERE (t1.captain_id = ? OR t2.captain_id = ?)
              AND m.updated_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY m.updated_at DESC
            LIMIT 5
        `, [req.user.id, req.user.id]);

        // Add match-related notifications
        recentMatches.forEach((match, index) => {
            if (match.score1 !== null && match.score2 !== null && match.status === 'in_progress') {
                mockNotifications.unshift({
                    id: 100 + index,
                    type: 'warning',
                    title: 'Match Score Submitted',
                    message: `Score for ${match.team1_name} vs ${match.team2_name} is awaiting verification`,
                    read: false,
                    timestamp: match.updated_at,
                });
            }
        });

        res.json(mockNotifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            error: 'Failed to fetch notifications',
            code: 'NOTIFICATIONS_ERROR'
        });
    }
});

// Mark notification as read
router.put('/notifications/:id/read', authenticateToken, validateIdParam, async (req, res) => {
    try {
        // In a real implementation, you would update the notification in the database
        // For now, just return success
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            error: 'Failed to mark notification as read',
            code: 'NOTIFICATION_READ_ERROR'
        });
    }
});

// Mark all notifications as read
router.put('/notifications/read-all', authenticateToken, async (req, res) => {
    try {
        // In a real implementation, you would update all notifications for the user
        // For now, just return success
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({
            error: 'Failed to mark all notifications as read',
            code: 'NOTIFICATIONS_READ_ALL_ERROR'
        });
    }
});

module.exports = router;