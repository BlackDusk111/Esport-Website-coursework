const { promisePool, logAudit } = require('../config/database');
const bcrypt = require('bcrypt');

class User {
    // Get all users with pagination and filters
    static async getAll(options = {}) {
        const {
            page = 1,
            limit = 20,
            search = '',
            role = '',
            isActive = null
        } = options;

        const offset = (page - 1) * limit;
        let query = `
            SELECT id, username, email, role, email_verified, account_locked, 
                   last_login, created_at, updated_at
            FROM users
            WHERE 1=1
        `;
        
        let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
        let queryParams = [];

        if (search) {
            query += ' AND (username LIKE ? OR email LIKE ?)';
            countQuery += ' AND (username LIKE ? OR email LIKE ?)';
            queryParams.push(`%${search}%`, `%${search}%`);
        }

        if (role) {
            query += ' AND role = ?';
            countQuery += ' AND role = ?';
            queryParams.push(role);
        }

        if (isActive !== null) {
            query += ' AND account_locked = ?';
            countQuery += ' AND account_locked = ?';
            queryParams.push(!isActive);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        queryParams.push(limit, offset);

        const [users] = await promisePool.execute(query, queryParams);
        const [countResult] = await promisePool.execute(countQuery, queryParams.slice(0, -2));

        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        return {
            users,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        };
    }

    // Get user by ID
    static async getById(id) {
        const [rows] = await promisePool.execute(`
            SELECT id, username, email, role, email_verified, account_locked, 
                   last_login, created_at, updated_at
            FROM users WHERE id = ?
        `, [id]);
        
        return rows[0];
    }

    // Get user by email
    static async getByEmail(email) {
        const [rows] = await promisePool.execute(`
            SELECT * FROM users WHERE email = ?
        `, [email]);
        
        return rows[0];
    }

    // Get user by username
    static async getByUsername(username) {
        const [rows] = await promisePool.execute(`
            SELECT * FROM users WHERE username = ?
        `, [username]);
        
        return rows[0];
    }

    // Create new user
    static async create(userData, ipAddress = '127.0.0.1') {
        const { username, email, password, role = 'player' } = userData;

        // Check if email already exists
        const [existingEmail] = await promisePool.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingEmail.length > 0) {
            throw new Error('Email already exists');
        }

        // Check if username already exists
        const [existingUsername] = await promisePool.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (existingUsername.length > 0) {
            throw new Error('Username already exists');
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const [result] = await promisePool.execute(`
            INSERT INTO users (username, email, password_hash, role)
            VALUES (?, ?, ?, ?)
        `, [username, email, passwordHash, role]);

        const userId = result.insertId;

        // Log audit
        await logAudit(userId, 'CREATE', 'users', userId, null, { username, email, role }, ipAddress);

        return userId;
    }

    // Update user
    static async update(id, updateData, adminId, ipAddress = '127.0.0.1') {
        const oldData = await this.getById(id);
        if (!oldData) {
            throw new Error('User not found');
        }

        const allowedFields = ['username', 'email', 'role', 'email_verified', 'account_locked'];
        const updates = [];
        const values = [];

        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                updates.push(`${field} = ?`);
                values.push(updateData[field]);
            }
        }

        if (updateData.password) {
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(updateData.password, saltRounds);
            updates.push('password_hash = ?');
            values.push(passwordHash);
        }

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        values.push(id);
        const [result] = await promisePool.execute(`
            UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, values);

        if (result.affectedRows === 0) {
            throw new Error('User not found');
        }

        // Log audit
        await logAudit(adminId, 'UPDATE', 'users', id, oldData, updateData, ipAddress);

        return true;
    }

    // Delete user (soft delete by locking account)
    static async delete(id, adminId, ipAddress = '127.0.0.1') {
        const oldData = await this.getById(id);
        if (!oldData) {
            throw new Error('User not found');
        }

        const [result] = await promisePool.execute(`
            UPDATE users SET account_locked = TRUE, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [id]);

        if (result.affectedRows === 0) {
            throw new Error('User not found');
        }

        // Log audit
        await logAudit(adminId, 'DELETE', 'users', id, oldData, { account_locked: true }, ipAddress);

        return true;
    }

    // Authenticate user
    static async authenticate(email, password, ipAddress = '127.0.0.1') {
        const user = await this.getByEmail(email);
        if (!user) {
            await this.recordLoginAttempt(email, ipAddress, null, false, 'User not found');
            throw new Error('Invalid credentials');
        }

        if (user.account_locked) {
            await this.recordLoginAttempt(email, ipAddress, null, false, 'Account locked');
            throw new Error('Account is locked');
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            await this.recordLoginAttempt(email, ipAddress, null, false, 'Invalid password');
            throw new Error('Invalid credentials');
        }

        // Update last login and reset failed login count
        await promisePool.execute(`
            UPDATE users SET last_login = CURRENT_TIMESTAMP, failed_login_count = 0
            WHERE id = ?
        `, [user.id]);

        await this.recordLoginAttempt(email, ipAddress, null, true);

        return user;
    }

    // Record login attempt
    static async recordLoginAttempt(email, ipAddress, userAgent, success, failureReason = null) {
        try {
            await promisePool.execute(`
                INSERT INTO login_attempts (email, ip_address, user_agent, success, failure_reason)
                VALUES (?, ?, ?, ?, ?)
            `, [email, ipAddress, userAgent, success, failureReason]);

            if (!success) {
                // Update failed login count
                await promisePool.execute(`
                    UPDATE users 
                    SET failed_login_count = failed_login_count + 1,
                        account_locked = CASE 
                            WHEN failed_login_count >= 4 THEN TRUE 
                            ELSE account_locked 
                        END
                    WHERE email = ?
                `, [email]);
            } else {
                // Reset failed login count on successful login
                await promisePool.execute(`
                    UPDATE users 
                    SET failed_login_count = 0, 
                        last_login = CURRENT_TIMESTAMP
                    WHERE email = ?
                `, [email]);
            }
        } catch (error) {
            console.error('Failed to record login attempt:', error);
        }
    }

    // Change password
    static async changePassword(userId, oldPassword, newPassword, ipAddress = '127.0.0.1') {
        const user = await this.getById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Verify old password
        const isValidPassword = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isValidPassword) {
            throw new Error('Invalid current password');
        }

        // Hash new password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        await promisePool.execute(`
            UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [passwordHash, userId]);

        // Log audit
        await logAudit(userId, 'CHANGE_PASSWORD', 'users', userId, null, { password_changed: true }, ipAddress);

        return true;
    }

    // Lock/Unlock user account
    static async toggleLock(userId, adminId, ipAddress = '127.0.0.1') {
        const user = await this.getById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const newLockStatus = !user.account_locked;
        await promisePool.execute(`
            UPDATE users SET account_locked = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [newLockStatus, userId]);

        // Log audit
        await logAudit(adminId, 'TOGGLE_LOCK', 'users', userId, { account_locked: user.account_locked }, { account_locked: newLockStatus }, ipAddress);

        return newLockStatus;
    }

    // Get user statistics
    static async getStats(userId) {
        const [stats] = await promisePool.execute(`
            SELECT 
                COUNT(DISTINCT t.id) as teams_created,
                COUNT(DISTINCT tm.team_id) as teams_joined,
                COUNT(DISTINCT tour.id) as tournaments_created
            FROM users u
            LEFT JOIN teams t ON u.id = t.captain_id
            LEFT JOIN team_members tm ON u.id = tm.user_id AND tm.status = 'active'
            LEFT JOIN tournaments tour ON u.id = tour.created_by
            WHERE u.id = ?
        `, [userId]);

        return stats[0];
    }

    // Get user's teams
    static async getUserTeams(userId) {
        const [teams] = await promisePool.execute(`
            SELECT t.*, tm.status as membership_status
            FROM teams t
            JOIN team_members tm ON t.id = tm.team_id
            WHERE tm.user_id = ? AND t.is_active = TRUE
            ORDER BY tm.status, t.created_at DESC
        `, [userId]);

        return teams;
    }

    // Get user's tournaments
    static async getUserTournaments(userId) {
        const [tournaments] = await promisePool.execute(`
            SELECT * FROM tournaments 
            WHERE created_by = ?
            ORDER BY created_at DESC
        `, [userId]);

        return tournaments;
    }
}

module.exports = User; 