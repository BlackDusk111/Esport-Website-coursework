const express = require('express');
const { promisePool, logAudit } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateIdParam, sanitizeInput } = require('../middleware/validation');

const router = express.Router();

// Apply input sanitization to all routes
router.use(sanitizeInput);

// Generate matches for a tournament (admin only)
router.post('/tournaments/:id/generate-matches', authenticateToken, requireAdmin, validateIdParam, async (req, res) => {
    try {
        const tournamentId = req.params.id;
        const { bracket_type = 'single_elimination' } = req.body;

        // Get tournament details
        const [tournaments] = await promisePool.execute(
            'SELECT id, name, status, max_teams FROM tournaments WHERE id = ?',
            [tournamentId]
        );

        if (tournaments.length === 0) {
            return res.status(404).json({
                error: 'Tournament not found',
                code: 'TOURNAMENT_NOT_FOUND'
            });
        }

        const tournament = tournaments[0];

        if (tournament.status !== 'active') {
            return res.status(400).json({
                error: 'Tournament must be active to generate matches',
                code: 'TOURNAMENT_NOT_ACTIVE'
            });
        }

        // Get registered teams
        const [registeredTeams] = await promisePool.execute(
            `SELECT DISTINCT t.id, t.name
             FROM teams t
             JOIN matches m ON (t.id = m.team1_id OR t.id = m.team2_id)
             WHERE m.tournament_id = ?
             ORDER BY t.name`,
            [tournamentId]
        );

        if (registeredTeams.length < 2) {
            return res.status(400).json({
                error: 'At least 2 teams must be registered',
                code: 'INSUFFICIENT_TEAMS'
            });
        }

        // Check if matches already exist
        const [existingMatches] = await promisePool.execute(
            'SELECT COUNT(*) as count FROM matches WHERE tournament_id = ?',
            [tournamentId]
        );

        if (existingMatches[0].count > 0) {
            return res.status(409).json({
                error: 'Matches already exist for this tournament',
                code: 'MATCHES_EXIST'
            });
        }

        // Generate matches based on bracket type
        let matches = [];
        const teams = registeredTeams;
        const startDate = new Date();
        startDate.setHours(startDate.getHours() + 24); // Start matches 24 hours from now

        if (bracket_type === 'single_elimination') {
            matches = generateSingleEliminationMatches(teams, startDate);
        } else if (bracket_type === 'round_robin') {
            matches = generateRoundRobinMatches(teams, startDate);
        } else {
            return res.status(400).json({
                error: 'Invalid bracket type',
                code: 'INVALID_BRACKET_TYPE'
            });
        }

        // Insert matches into database
        for (const match of matches) {
            await promisePool.execute(
                'INSERT INTO matches (tournament_id, team1_id, team2_id, scheduled_time, status) VALUES (?, ?, ?, ?, ?)',
                [tournamentId, match.team1_id, match.team2_id, match.scheduled_time, 'scheduled']
            );
        }

        // Log match generation
        await logAudit(req.user.id, 'GENERATE_MATCHES', 'tournaments', tournamentId, null, {
            bracket_type,
            matches_generated: matches.length,
            teams_count: teams.length
        }, req.ip);

        res.json({
            message: 'Matches generated successfully',
            matches_generated: matches.length,
            bracket_type
        });

    } catch (error) {
        console.error('Generate matches error:', error);
        res.status(500).json({
            error: 'Failed to generate matches',
            code: 'GENERATE_MATCHES_ERROR'
        });
    }
});

// Get tournament schedule
router.get('/tournaments/:id/schedule', validateIdParam, async (req, res) => {
    try {
        const tournamentId = req.params.id;

        // Get tournament matches with team info
        const [matches] = await promisePool.execute(
            `SELECT m.id, m.scheduled_time, m.score1, m.score2, m.status,
                    m.created_at, m.updated_at,
                    t1.id as team1_id, t1.name as team1_name,
                    t2.id as team2_id, t2.name as team2_name,
                    u.username as submitted_by_username
             FROM matches m
             JOIN teams t1 ON m.team1_id = t1.id
             JOIN teams t2 ON m.team2_id = t2.id
             LEFT JOIN users u ON m.submitted_by_user_id = u.id
             WHERE m.tournament_id = ?
             ORDER BY m.scheduled_time ASC`,
            [tournamentId]
        );

        // Group matches by round (for elimination tournaments)
        const schedule = groupMatchesByRound(matches);

        res.json({
            tournament_id: tournamentId,
            matches,
            schedule
        });

    } catch (error) {
        console.error('Get schedule error:', error);
        res.status(500).json({
            error: 'Failed to get tournament schedule',
            code: 'GET_SCHEDULE_ERROR'
        });
    }
});

// Update match schedule (admin only)
router.put('/matches/:id/schedule', authenticateToken, requireAdmin, validateIdParam, async (req, res) => {
    try {
        const matchId = req.params.id;
        const { scheduled_time } = req.body;

        if (!scheduled_time) {
            return res.status(400).json({
                error: 'Scheduled time is required',
                code: 'SCHEDULED_TIME_REQUIRED'
            });
        }

        // Validate date
        const newDate = new Date(scheduled_time);
        if (isNaN(newDate.getTime())) {
            return res.status(400).json({
                error: 'Invalid date format',
                code: 'INVALID_DATE'
            });
        }

        // Get current match data
        const [currentMatches] = await promisePool.execute(
            'SELECT scheduled_time FROM matches WHERE id = ?',
            [matchId]
        );

        if (currentMatches.length === 0) {
            return res.status(404).json({
                error: 'Match not found',
                code: 'MATCH_NOT_FOUND'
            });
        }

        const oldScheduledTime = currentMatches[0].scheduled_time;

        // Update match schedule
        await promisePool.execute(
            'UPDATE matches SET scheduled_time = ?, updated_at = NOW() WHERE id = ?',
            [scheduled_time, matchId]
        );

        // Log the update
        await logAudit(req.user.id, 'RESCHEDULE_MATCH', 'matches', matchId, 
            { scheduled_time: oldScheduledTime }, 
            { scheduled_time }, 
            req.ip
        );

        res.json({
            message: 'Match rescheduled successfully'
        });

    } catch (error) {
        console.error('Reschedule match error:', error);
        res.status(500).json({
            error: 'Failed to reschedule match',
            code: 'RESCHEDULE_ERROR'
        });
    }
});

// Helper function to generate single elimination matches
function generateSingleEliminationMatches(teams, startDate) {
    const matches = [];
    const teamsCount = teams.length;
    
    // Calculate number of rounds needed
    const rounds = Math.ceil(Math.log2(teamsCount));
    
    // First round matches
    const firstRoundMatches = Math.floor(teamsCount / 2);
    let currentTime = new Date(startDate);
    
    for (let i = 0; i < firstRoundMatches; i++) {
        matches.push({
            team1_id: teams[i * 2].id,
            team2_id: teams[i * 2 + 1].id,
            scheduled_time: new Date(currentTime),
            round: 1
        });
        
        // Schedule matches 2 hours apart
        currentTime.setHours(currentTime.getHours() + 2);
    }
    
    return matches;
}

// Helper function to generate round robin matches
function generateRoundRobinMatches(teams, startDate) {
    const matches = [];
    let currentTime = new Date(startDate);
    
    for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
            matches.push({
                team1_id: teams[i].id,
                team2_id: teams[j].id,
                scheduled_time: new Date(currentTime),
                round: 1
            });
            
            // Schedule matches 2 hours apart
            currentTime.setHours(currentTime.getHours() + 2);
        }
    }
    
    return matches;
}

// Helper function to group matches by round
function groupMatchesByRound(matches) {
    const schedule = {};
    
    matches.forEach(match => {
        const date = new Date(match.scheduled_time).toDateString();
        if (!schedule[date]) {
            schedule[date] = [];
        }
        schedule[date].push(match);
    });
    
    return schedule;
}

module.exports = router;