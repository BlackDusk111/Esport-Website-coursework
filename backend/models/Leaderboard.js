const { promisePool } = require('../config/database');

class Leaderboard {
    // Get global leaderboard
    static async getGlobal(options = {}) {
        const {
            page = 1,
            limit = 20,
            game = '',
            timeRange = 'all' // all, month, week
        } = options;

        const offset = (page - 1) * limit;
        
        let dateFilter = '';
        if (timeRange === 'month') {
            dateFilter = 'AND m.updated_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
        } else if (timeRange === 'week') {
            dateFilter = 'AND m.updated_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)';
        }

        let gameFilter = '';
        if (game) {
            gameFilter = 'AND t.game = ?';
        }

        const query = `
            SELECT 
                teams.id,
                teams.name as team_name,
                COUNT(DISTINCT m.id) as total_matches,
                COUNT(CASE WHEN (m.team1_id = teams.id AND m.score1 > m.score2) OR 
                               (m.team2_id = teams.id AND m.score2 > m.score1) THEN 1 END) as wins,
                COUNT(CASE WHEN (m.team1_id = teams.id AND m.score1 < m.score2) OR 
                               (m.team2_id = teams.id AND m.score2 < m.score1) THEN 1 END) as losses,
                COUNT(CASE WHEN (m.team1_id = teams.id AND m.score1 = m.score2) OR 
                               (m.team2_id = teams.id AND m.score2 = m.score1) THEN 1 END) as draws,
                ROUND(
                    (COUNT(CASE WHEN (m.team1_id = teams.id AND m.score1 > m.score2) OR 
                                   (m.team2_id = teams.id AND m.score2 > m.score1) THEN 1 END) * 3 +
                     COUNT(CASE WHEN (m.team1_id = teams.id AND m.score1 = m.score2) OR 
                                   (m.team2_id = teams.id AND m.score2 = m.score1) THEN 1 END) * 1) /
                    GREATEST(COUNT(DISTINCT m.id), 1) * 100, 2
                ) as win_percentage
            FROM teams
            LEFT JOIN matches m ON (m.team1_id = teams.id OR m.team2_id = teams.id) 
                AND m.status = 'completed' ${dateFilter}
            LEFT JOIN tournaments t ON m.tournament_id = t.id ${gameFilter}
            WHERE teams.is_active = TRUE
            GROUP BY teams.id
            HAVING total_matches > 0
            ORDER BY win_percentage DESC, wins DESC, total_matches DESC
            LIMIT ? OFFSET ?
        `;

        const countQuery = `
            SELECT COUNT(DISTINCT teams.id) as total
            FROM teams
            LEFT JOIN matches m ON (m.team1_id = teams.id OR m.team2_id = teams.id) 
                AND m.status = 'completed' ${dateFilter}
            LEFT JOIN tournaments t ON m.tournament_id = t.id ${gameFilter}
            WHERE teams.is_active = TRUE
        `;

        let params = [];
        if (game) {
            params.push(game);
        }
        params.push(limit, offset);

        const [leaderboard] = await promisePool.execute(query, params);
        const [countResult] = await promisePool.execute(countQuery, game ? [game] : []);

        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        return {
            leaderboard,
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

    // Get tournament leaderboard
    static async getTournamentLeaderboard(tournamentId, options = {}) {
        const { page = 1, limit = 20 } = options;
        const offset = (page - 1) * limit;

        const query = `
            SELECT 
                teams.id,
                teams.name as team_name,
                COUNT(DISTINCT m.id) as total_matches,
                COUNT(CASE WHEN (m.team1_id = teams.id AND m.score1 > m.score2) OR 
                               (m.team2_id = teams.id AND m.score2 > m.score1) THEN 1 END) as wins,
                COUNT(CASE WHEN (m.team1_id = teams.id AND m.score1 < m.score2) OR 
                               (m.team2_id = teams.id AND m.score2 < m.score1) THEN 1 END) as losses,
                COUNT(CASE WHEN (m.team1_id = teams.id AND m.score1 = m.score2) OR 
                               (m.team2_id = teams.id AND m.score2 = m.score1) THEN 1 END) as draws,
                ROUND(
                    (COUNT(CASE WHEN (m.team1_id = teams.id AND m.score1 > m.score2) OR 
                                   (m.team2_id = teams.id AND m.score2 > m.score1) THEN 1 END) * 3 +
                     COUNT(CASE WHEN (m.team1_id = teams.id AND m.score1 = m.score2) OR 
                                   (m.team2_id = teams.id AND m.score2 = m.score1) THEN 1 END) * 1) /
                    GREATEST(COUNT(DISTINCT m.id), 1) * 100, 2
                ) as win_percentage
            FROM teams
            LEFT JOIN matches m ON (m.team1_id = teams.id OR m.team2_id = teams.id) 
                AND m.tournament_id = ? AND m.status = 'completed'
            WHERE teams.is_active = TRUE
            GROUP BY teams.id
            HAVING total_matches > 0
            ORDER BY win_percentage DESC, wins DESC, total_matches DESC
            LIMIT ? OFFSET ?
        `;

        const countQuery = `
            SELECT COUNT(DISTINCT teams.id) as total
            FROM teams
            LEFT JOIN matches m ON (m.team1_id = teams.id OR m.team2_id = teams.id) 
                AND m.tournament_id = ? AND m.status = 'completed'
            WHERE teams.is_active = TRUE
        `;

        const [leaderboard] = await promisePool.execute(query, [tournamentId, limit, offset]);
        const [countResult] = await promisePool.execute(countQuery, [tournamentId]);

        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        return {
            leaderboard,
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

    // Get team statistics
    static async getTeamStats(teamId, options = {}) {
        const { timeRange = 'all' } = options;
        
        let dateFilter = '';
        if (timeRange === 'month') {
            dateFilter = 'AND m.updated_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
        } else if (timeRange === 'week') {
            dateFilter = 'AND m.updated_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)';
        }

        const query = `
            SELECT 
                COUNT(DISTINCT m.id) as total_matches,
                COUNT(CASE WHEN (m.team1_id = ? AND m.score1 > m.score2) OR 
                               (m.team2_id = ? AND m.score2 > m.score1) THEN 1 END) as wins,
                COUNT(CASE WHEN (m.team1_id = ? AND m.score1 < m.score2) OR 
                               (m.team2_id = ? AND m.score2 < m.score1) THEN 1 END) as losses,
                COUNT(CASE WHEN (m.team1_id = ? AND m.score1 = m.score2) OR 
                               (m.team2_id = ? AND m.score2 = m.score1) THEN 1 END) as draws,
                ROUND(
                    (COUNT(CASE WHEN (m.team1_id = ? AND m.score1 > m.score2) OR 
                                   (m.team2_id = ? AND m.score2 > m.score1) THEN 1 END) * 3 +
                     COUNT(CASE WHEN (m.team1_id = ? AND m.score1 = m.score2) OR 
                                   (m.team2_id = ? AND m.score2 = m.score1) THEN 1 END) * 1) /
                    GREATEST(COUNT(DISTINCT m.id), 1) * 100, 2
                ) as win_percentage
            FROM matches m
            WHERE (m.team1_id = ? OR m.team2_id = ?) 
                AND m.status = 'completed' ${dateFilter}
        `;

        const [stats] = await promisePool.execute(query, [
            teamId, teamId, teamId, teamId, teamId, teamId,
            teamId, teamId, teamId, teamId, teamId, teamId
        ]);

        return stats[0];
    }

    // Get user statistics
    static async getUserStats(userId, options = {}) {
        const { timeRange = 'all' } = options;
        
        let dateFilter = '';
        if (timeRange === 'month') {
            dateFilter = 'AND m.updated_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
        } else if (timeRange === 'week') {
            dateFilter = 'AND m.updated_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)';
        }

        const query = `
            SELECT 
                COUNT(DISTINCT m.id) as total_matches,
                COUNT(CASE WHEN (m.team1_id IN (SELECT team_id FROM team_members WHERE user_id = ? AND status = 'active') AND m.score1 > m.score2) OR 
                               (m.team2_id IN (SELECT team_id FROM team_members WHERE user_id = ? AND status = 'active') AND m.score2 > m.score1) THEN 1 END) as wins,
                COUNT(CASE WHEN (m.team1_id IN (SELECT team_id FROM team_members WHERE user_id = ? AND status = 'active') AND m.score1 < m.score2) OR 
                               (m.team2_id IN (SELECT team_id FROM team_members WHERE user_id = ? AND status = 'active') AND m.score2 < m.score1) THEN 1 END) as losses,
                COUNT(CASE WHEN (m.team1_id IN (SELECT team_id FROM team_members WHERE user_id = ? AND status = 'active') AND m.score1 = m.score2) OR 
                               (m.team2_id IN (SELECT team_id FROM team_members WHERE user_id = ? AND status = 'active') AND m.score2 = m.score1) THEN 1 END) as draws
            FROM matches m
            WHERE (m.team1_id IN (SELECT team_id FROM team_members WHERE user_id = ? AND status = 'active') OR 
                   m.team2_id IN (SELECT team_id FROM team_members WHERE user_id = ? AND status = 'active'))
                AND m.status = 'completed' ${dateFilter}
        `;

        const [stats] = await promisePool.execute(query, [
            userId, userId, userId, userId, userId, userId, userId, userId
        ]);

        return stats[0];
    }

    // Get top teams by game
    static async getTopTeamsByGame(game, limit = 10) {
        const query = `
            SELECT 
                teams.id,
                teams.name as team_name,
                COUNT(DISTINCT m.id) as total_matches,
                COUNT(CASE WHEN (m.team1_id = teams.id AND m.score1 > m.score2) OR 
                               (m.team2_id = teams.id AND m.score2 > m.score1) THEN 1 END) as wins,
                COUNT(CASE WHEN (m.team1_id = teams.id AND m.score1 < m.score2) OR 
                               (m.team2_id = teams.id AND m.score2 < m.score1) THEN 1 END) as losses,
                ROUND(
                    (COUNT(CASE WHEN (m.team1_id = teams.id AND m.score1 > m.score2) OR 
                                   (m.team2_id = teams.id AND m.score2 > m.score1) THEN 1 END) * 3) /
                    GREATEST(COUNT(DISTINCT m.id), 1) * 100, 2
                ) as win_percentage
            FROM teams
            LEFT JOIN matches m ON (m.team1_id = teams.id OR m.team2_id = teams.id) 
                AND m.status = 'completed'
            LEFT JOIN tournaments t ON m.tournament_id = t.id AND t.game = ?
            WHERE teams.is_active = TRUE
            GROUP BY teams.id
            HAVING total_matches > 0
            ORDER BY win_percentage DESC, wins DESC
            LIMIT ?
        `;

        const [teams] = await promisePool.execute(query, [game, limit]);
        return teams;
    }

    // Get recent matches for leaderboard
    static async getRecentMatches(limit = 10) {
        const query = `
            SELECT 
                m.id,
                m.score1,
                m.score2,
                t1.name as team1_name,
                t2.name as team2_name,
                tour.name as tournament_name,
                m.updated_at
            FROM matches m
            JOIN teams t1 ON m.team1_id = t1.id
            JOIN teams t2 ON m.team2_id = t2.id
            JOIN tournaments tour ON m.tournament_id = tour.id
            WHERE m.status = 'completed'
            ORDER BY m.updated_at DESC
            LIMIT ?
        `;

        const [matches] = await promisePool.execute(query, [limit]);
        return matches;
    }
}

module.exports = Leaderboard; 