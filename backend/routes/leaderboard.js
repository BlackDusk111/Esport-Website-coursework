const express = require('express');
const { promisePool } = require('../config/database');
const { optionalAuth } = require('../middleware/auth');
const { validatePagination, sanitizeInput } = require('../middleware/validation');

const router = express.Router();

// Apply input sanitization to all routes
router.use(sanitizeInput);

// Get team leaderboard
router.get('/teams', optionalAuth, validatePagination, async (req, res) => {
    try {
        // Check if database is connected
        if (!req.dbConnected) {
            // Return mock data for development
            const mockTeams = [
                {
                    id: 1,
                    name: "Team Alpha",
                    captain_id: 1,
                    captain_username: "captain1",
                    member_count: 5,
                    total_matches: 10,
                    wins: 7,
                    losses: 2,
                    draws: 1,
                    win_percentage: 70.0,
                    total_score_for: 25,
                    total_score_against: 15,
                    rank: 1,
                    score_difference: 10,
                    created_at: "2024-01-15T10:00:00Z"
                },
                {
                    id: 2,
                    name: "Team Beta",
                    captain_id: 2,
                    captain_username: "captain2",
                    member_count: 4,
                    total_matches: 8,
                    wins: 5,
                    losses: 2,
                    draws: 1,
                    win_percentage: 62.5,
                    total_score_for: 18,
                    total_score_against: 12,
                    rank: 2,
                    score_difference: 6,
                    created_at: "2024-01-20T10:00:00Z"
                }
            ];
            
            return res.json({
                teams: mockTeams,
                pagination: {
                    page: parseInt(req.query.page) || 1,
                    limit: parseInt(req.query.limit) || 20,
                    total: mockTeams.length,
                    totalPages: 1,
                    hasNext: false,
                    hasPrev: false
                }
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const game = req.query.game || '';

        let query = `
            SELECT 
                t.id,
                t.name,
                t.captain_id,
                u.username as captain_username,
                COUNT(DISTINCT tm.user_id) as member_count,
                COUNT(DISTINCT m.id) as total_matches,
                SUM(CASE 
                    WHEN (m.team1_id = t.id AND m.score1 > m.score2) OR 
                         (m.team2_id = t.id AND m.score2 > m.score1) 
                    THEN 1 ELSE 0 
                END) as wins,
                SUM(CASE 
                    WHEN (m.team1_id = t.id AND m.score1 < m.score2) OR 
                         (m.team2_id = t.id AND m.score2 < m.score1) 
                    THEN 1 ELSE 0 
                END) as losses,
                SUM(CASE 
                    WHEN (m.team1_id = t.id AND m.score1 = m.score2) OR 
                         (m.team2_id = t.id AND m.score2 = m.score1) 
                    THEN 1 ELSE 0 
                END) as draws,
                ROUND(
                    CASE 
                        WHEN COUNT(DISTINCT m.id) > 0 
                        THEN (SUM(CASE 
                            WHEN (m.team1_id = t.id AND m.score1 > m.score2) OR 
                                 (m.team2_id = t.id AND m.score2 > m.score1) 
                            THEN 1 ELSE 0 
                        END) * 100.0) / COUNT(DISTINCT m.id)
                        ELSE 0 
                    END, 2
                ) as win_percentage,
                SUM(CASE WHEN m.team1_id = t.id THEN m.score1 ELSE m.score2 END) as total_score_for,
                SUM(CASE WHEN m.team1_id = t.id THEN m.score2 ELSE m.score1 END) as total_score_against,
                t.created_at
            FROM teams t
            JOIN users u ON t.captain_id = u.id
            LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.status = 'active'
            LEFT JOIN matches m ON (t.id = m.team1_id OR t.id = m.team2_id) AND m.status = 'completed'
        `;

        let countQuery = 'SELECT COUNT(DISTINCT t.id) as total FROM teams t';
        let queryParams = [];

        if (game) {
            query += ` LEFT JOIN tournaments tour ON m.tournament_id = tour.id
                       WHERE t.is_active = TRUE AND tour.game = ?`;
            countQuery += ` LEFT JOIN matches m ON (t.id = m.team1_id OR t.id = m.team2_id)
                           LEFT JOIN tournaments tour ON m.tournament_id = tour.id
                           WHERE t.is_active = TRUE AND tour.game = ?`;
            queryParams = [game];
        } else {
            query += ' WHERE t.is_active = TRUE';
            countQuery += ' WHERE t.is_active = TRUE';
        }

        query += `
            GROUP BY t.id, t.name, t.captain_id, u.username, t.created_at
            ORDER BY win_percentage DESC, wins DESC, total_matches DESC
            LIMIT ? OFFSET ?
        `;
        queryParams.push(limit, offset);

        const [teams] = await promisePool.execute(query, queryParams);
        const [countResult] = await promisePool.execute(countQuery, game ? [game] : []);

        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        // Add ranking
        const rankedTeams = teams.map((team, index) => ({
            ...team,
            rank: offset + index + 1,
            total_score_for: parseInt(team.total_score_for) || 0,
            total_score_against: parseInt(team.total_score_against) || 0,
            score_difference: (parseInt(team.total_score_for) || 0) - (parseInt(team.total_score_against) || 0)
        }));

        res.json({
            teams: rankedTeams,
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
        console.error('Get team leaderboard error:', error);
        res.status(500).json({
            error: 'Failed to get team leaderboard',
            code: 'GET_LEADERBOARD_ERROR'
        });
    }
});

// Get player leaderboard
router.get('/players', optionalAuth, validatePagination, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const game = req.query.game || '';

        let query = `
            SELECT 
                u.id,
                u.username,
                u.role,
                COUNT(DISTINCT t.id) as teams_count,
                COUNT(DISTINCT m.id) as total_matches,
                SUM(CASE 
                    WHEN (m.team1_id = t.id AND m.score1 > m.score2) OR 
                         (m.team2_id = t.id AND m.score2 > m.score1) 
                    THEN 1 ELSE 0 
                END) as wins,
                SUM(CASE 
                    WHEN (m.team1_id = t.id AND m.score1 < m.score2) OR 
                         (m.team2_id = t.id AND m.score2 < m.score1) 
                    THEN 1 ELSE 0 
                END) as losses,
                ROUND(
                    CASE 
                        WHEN COUNT(DISTINCT m.id) > 0 
                        THEN (SUM(CASE 
                            WHEN (m.team1_id = t.id AND m.score1 > m.score2) OR 
                                 (m.team2_id = t.id AND m.score2 > m.score1) 
                            THEN 1 ELSE 0 
                        END) * 100.0) / COUNT(DISTINCT m.id)
                        ELSE 0 
                    END, 2
                ) as win_percentage,
                COUNT(DISTINCT CASE WHEN t.captain_id = u.id THEN t.id END) as teams_captained,
                u.created_at
            FROM users u
            LEFT JOIN team_members tm ON u.id = tm.user_id AND tm.status = 'active'
            LEFT JOIN teams t ON tm.team_id = t.id AND t.is_active = TRUE
            LEFT JOIN matches m ON (t.id = m.team1_id OR t.id = m.team2_id) AND m.status = 'completed'
        `;

        let countQuery = 'SELECT COUNT(DISTINCT u.id) as total FROM users u';
        let queryParams = [];

        if (game) {
            query += ` LEFT JOIN tournaments tour ON m.tournament_id = tour.id
                       WHERE u.account_locked = FALSE AND tour.game = ?`;
            countQuery += ` LEFT JOIN team_members tm ON u.id = tm.user_id
                           LEFT JOIN teams t ON tm.team_id = t.id
                           LEFT JOIN matches m ON (t.id = m.team1_id OR t.id = m.team2_id)
                           LEFT JOIN tournaments tour ON m.tournament_id = tour.id
                           WHERE u.account_locked = FALSE AND tour.game = ?`;
            queryParams = [game];
        } else {
            query += ' WHERE u.account_locked = FALSE';
            countQuery += ' WHERE u.account_locked = FALSE';
        }

        query += `
            GROUP BY u.id, u.username, u.role, u.created_at
            HAVING total_matches > 0
            ORDER BY win_percentage DESC, wins DESC, total_matches DESC
            LIMIT ? OFFSET ?
        `;
        queryParams.push(limit, offset);

        const [players] = await promisePool.execute(query, queryParams);
        const [countResult] = await promisePool.execute(countQuery, game ? [game] : []);

        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        // Add ranking
        const rankedPlayers = players.map((player, index) => ({
            ...player,
            rank: offset + index + 1
        }));

        res.json({
            players: rankedPlayers,
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
        console.error('Get player leaderboard error:', error);
        res.status(500).json({
            error: 'Failed to get player leaderboard',
            code: 'GET_PLAYER_LEADERBOARD_ERROR'
        });
    }
});

// Get tournament leaderboard
router.get('/tournaments', optionalAuth, validatePagination, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const status = req.query.status || '';

        let query = `
            SELECT 
                t.id,
                t.name,
                t.game,
                t.status,
                t.max_teams,
                t.start_date,
                t.end_date,
                u.username as created_by_username,
                COUNT(DISTINCT CASE 
                    WHEN m.team1_id IS NOT NULL THEN m.team1_id 
                    WHEN m.team2_id IS NOT NULL THEN m.team2_id 
                END) as registered_teams,
                COUNT(DISTINCT m.id) as total_matches,
                COUNT(DISTINCT CASE WHEN m.status = 'completed' THEN m.id END) as completed_matches,
                ROUND(
                    CASE 
                        WHEN COUNT(DISTINCT m.id) > 0 
                        THEN (COUNT(DISTINCT CASE WHEN m.status = 'completed' THEN m.id END) * 100.0) / COUNT(DISTINCT m.id)
                        ELSE 0 
                    END, 2
                ) as completion_percentage,
                t.created_at
            FROM tournaments t
            JOIN users u ON t.created_by = u.id
            LEFT JOIN matches m ON t.id = m.tournament_id
        `;

        let countQuery = 'SELECT COUNT(*) as total FROM tournaments t';
        let queryParams = [];

        if (status) {
            query += ' WHERE t.status = ?';
            countQuery += ' WHERE t.status = ?';
            queryParams = [status];
        }

        query += `
            GROUP BY t.id, t.name, t.game, t.status, t.max_teams, t.start_date, t.end_date, u.username, t.created_at
            ORDER BY 
                CASE t.status 
                    WHEN 'active' THEN 1 
                    WHEN 'completed' THEN 2 
                    WHEN 'draft' THEN 3 
                    ELSE 4 
                END,
                completion_percentage DESC,
                registered_teams DESC,
                t.start_date DESC
            LIMIT ? OFFSET ?
        `;
        queryParams.push(limit, offset);

        const [tournaments] = await promisePool.execute(query, queryParams);
        const [countResult] = await promisePool.execute(countQuery, status ? [status] : []);

        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        // Add ranking
        const rankedTournaments = tournaments.map((tournament, index) => ({
            ...tournament,
            rank: offset + index + 1,
            registered_teams: parseInt(tournament.registered_teams) || 0,
            total_matches: parseInt(tournament.total_matches) || 0,
            completed_matches: parseInt(tournament.completed_matches) || 0
        }));

        res.json({
            tournaments: rankedTournaments,
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
        console.error('Get tournament leaderboard error:', error);
        res.status(500).json({
            error: 'Failed to get tournament leaderboard',
            code: 'GET_TOURNAMENT_LEADERBOARD_ERROR'
        });
    }
});

// Get leaderboard statistics
router.get('/stats', optionalAuth, async (req, res) => {
    try {
        // Check if database is connected
        if (!req.dbConnected) {
            // Return mock data for development
            const mockStats = {
                total_players: 45,
                total_teams: 12,
                total_tournaments: 8,
                total_matches: 156,
                total_games: 5
            };

            const mockTopGames = [
                {
                    game: "League of Legends",
                    tournament_count: 3,
                    total_teams: 24,
                    total_matches: 45
                },
                {
                    game: "Counter-Strike: Global Offensive",
                    tournament_count: 2,
                    total_teams: 16,
                    total_matches: 32
                },
                {
                    game: "Valorant",
                    tournament_count: 2,
                    total_teams: 12,
                    total_matches: 28
                }
            ];

            const mockRecentMatches = [
                {
                    id: 1,
                    score1: 2,
                    score2: 1,
                    updated_at: "2024-06-15T16:00:00Z",
                    team1_name: "Team Alpha",
                    team2_name: "Team Beta",
                    tournament_name: "Summer Gaming Championship",
                    game: "League of Legends"
                },
                {
                    id: 2,
                    score1: 1,
                    score2: 2,
                    updated_at: "2024-06-14T18:00:00Z",
                    team1_name: "Team Gamma",
                    team2_name: "Team Delta",
                    tournament_name: "CS:GO Pro League",
                    game: "Counter-Strike: Global Offensive"
                }
            ];

            return res.json({
                stats: mockStats,
                top_games: mockTopGames,
                recent_matches: mockRecentMatches
            });
        }

        // Get overall statistics
        const [totalStats] = await promisePool.execute(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE account_locked = FALSE) as total_players,
                (SELECT COUNT(*) FROM teams WHERE is_active = TRUE) as total_teams,
                (SELECT COUNT(*) FROM tournaments) as total_tournaments,
                (SELECT COUNT(*) FROM matches WHERE status = 'completed') as total_matches,
                (SELECT COUNT(DISTINCT game) FROM tournaments) as total_games
        `);

        // Get top games by tournament count
        const [topGames] = await promisePool.execute(`
            SELECT 
                game,
                COUNT(*) as tournament_count,
                COUNT(DISTINCT CASE 
                    WHEN m.team1_id IS NOT NULL THEN m.team1_id 
                    WHEN m.team2_id IS NOT NULL THEN m.team2_id 
                END) as total_teams,
                COUNT(DISTINCT m.id) as total_matches
            FROM tournaments t
            LEFT JOIN matches m ON t.id = m.tournament_id
            GROUP BY game
            ORDER BY tournament_count DESC, total_matches DESC
            LIMIT 5
        `);

        // Get recent activity
        const [recentMatches] = await promisePool.execute(`
            SELECT 
                m.id,
                m.score1,
                m.score2,
                m.updated_at,
                t1.name as team1_name,
                t2.name as team2_name,
                tour.name as tournament_name,
                tour.game
            FROM matches m
            JOIN teams t1 ON m.team1_id = t1.id
            JOIN teams t2 ON m.team2_id = t2.id
            JOIN tournaments tour ON m.tournament_id = tour.id
            WHERE m.status = 'completed'
            ORDER BY m.updated_at DESC
            LIMIT 10
        `);

        res.json({
            stats: totalStats[0],
            top_games: topGames.map(game => ({
                ...game,
                tournament_count: parseInt(game.tournament_count),
                total_teams: parseInt(game.total_teams) || 0,
                total_matches: parseInt(game.total_matches) || 0
            })),
            recent_matches: recentMatches
        });

    } catch (error) {
        console.error('Get leaderboard stats error:', error);
        res.status(500).json({
            error: 'Failed to get leaderboard statistics',
            code: 'GET_STATS_ERROR'
        });
    }
});

module.exports = router;