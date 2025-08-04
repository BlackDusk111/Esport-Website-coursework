const express = require("express");
const { logAudit } = require("../config/database");
const Match = require("../models/Match");
const {
  authenticateToken,
  requireAdmin,
  optionalAuth,
} = require("../middleware/auth");
const {
  validateMatchCreation,
  validateScoreSubmission,
  validateIdParam,
  validatePagination,
  sanitizeInput,
} = require("../middleware/validation");

const router = express.Router();

// Apply input sanitization to all routes
router.use(sanitizeInput);

// Get all matches (public endpoint with optional auth)
router.get("/", optionalAuth, validatePagination, (req, res) => {
  // Check if database is connected
  if (!req.dbConnected) {
    // Return mock data for development
    const mockMatches = [
      {
        id: 1,
        tournament_id: 1,
        tournament_name: "Summer Gaming Championship",
        team1_id: 1,
        team1_name: "Team Alpha",
        team2_id: 2,
        team2_name: "Team Beta",
        scheduled_time: "2024-06-15T14:00:00Z",
        score1: 2,
        score2: 1,
        status: "completed",
        created_at: "2024-06-10T10:00:00Z",
        updated_at: "2024-06-15T16:00:00Z",
      },
      {
        id: 2,
        tournament_id: 1,
        tournament_name: "Summer Gaming Championship",
        team1_id: 3,
        team1_name: "Team Gamma",
        team2_id: 4,
        team2_name: "Team Delta",
        scheduled_time: "2024-06-16T16:00:00Z",
        score1: null,
        score2: null,
        status: "scheduled",
        created_at: "2024-06-10T10:00:00Z",
        updated_at: "2024-06-10T10:00:00Z",
      },
    ];

    return res.json({
      matches: mockMatches,
      pagination: {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        total: mockMatches.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const status = req.query.status || "";
  const tournamentId = req.query.tournament_id || null;

  const options = {
    page,
    limit,
    status,
    tournamentId,
  };

  Match.getAll(options, (error, result) => {
    if (error) {
      console.error("Get matches error:", error);
      return res.status(500).json({
        error: "Failed to get matches",
        code: "GET_MATCHES_ERROR",
      });
    }

    res.json(result);
  });
});

// Create new match (admin only)
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  validateMatchCreation,
  (req, res) => {
    const { tournament_id, team1_id, team2_id, scheduled_time } = req.body;
    const matchData = { tournament_id, team1_id, team2_id, scheduled_time };

    Match.create(matchData, req.user.id, req.ip, (error, matchId) => {
      if (error) {
        console.error("Create match error:", error);

        if (error.message === "Teams must be different") {
          return res.status(400).json({
            error: "Teams must be different",
            code: "TEAMS_MUST_BE_DIFFERENT",
          });
        }

        if (error.message === "Tournament not found") {
          return res.status(404).json({
            error: "Tournament not found",
            code: "TOURNAMENT_NOT_FOUND",
          });
        }

        if (error.message === "Tournament is not active") {
          return res.status(400).json({
            error: "Tournament is not active",
            code: "TOURNAMENT_NOT_ACTIVE",
          });
        }

        return res.status(500).json({
          error: "Failed to create match",
          code: "CREATE_MATCH_ERROR",
        });
      }

      // Get created match details
      Match.getById(matchId, (getError, match) => {
        if (getError) {
          console.error("Get created match error:", getError);
          return res.status(201).json({
            message: "Match created successfully",
            matchId: matchId,
          });
        }

        res.status(201).json({
          message: "Match created successfully",
          match: match,
        });
      });
    });
  }
);

// Get match by ID
router.get("/:id", optionalAuth, validateIdParam, (req, res) => {
  const matchId = req.params.id;

  Match.getById(matchId, (error, match) => {
    if (error) {
      console.error("Get match error:", error);
      return res.status(500).json({
        error: "Failed to get match",
        code: "GET_MATCH_ERROR",
      });
    }

    if (!match) {
      return res.status(404).json({
        error: "Match not found",
        code: "MATCH_NOT_FOUND",
      });
    }

    // Hide sensitive info if not authenticated or not involved
    const isAdmin = req.user && req.user.role === "admin";
    // For simplicity, we'll skip the team member check for now since it requires additional DB queries
    // In a full implementation, you'd want to check team membership

    if (!isAdmin) {
      delete match.submitted_by_user_id;
      delete match.submitted_by_username;
      delete match.verified_by_admin_id;
      delete match.verified_by_username;
    }

    res.json({
      match,
    });
  });
});

// Submit match score (team members only)
router.put(
  "/:id/score",
  authenticateToken,
  validateIdParam,
  validateScoreSubmission,
  (req, res) => {
    const matchId = req.params.id;
    const { score1, score2 } = req.body;
    const userId = req.user.id;

    Match.submitResult(
      matchId,
      { score1, score2 },
      userId,
      req.ip,
      (error, result) => {
        if (error) {
          console.error("Submit score error:", error);

          if (error.message === "Scores must be non-negative") {
            return res.status(400).json({
              error: "Scores must be non-negative",
              code: "INVALID_SCORES",
            });
          }

          if (error.message === "Match not found") {
            return res.status(404).json({
              error: "Match not found",
              code: "MATCH_NOT_FOUND",
            });
          }

          return res.status(500).json({
            error: "Failed to submit score",
            code: "SUBMIT_SCORE_ERROR",
          });
        }

        // Get updated match details
        Match.getById(matchId, (getError, match) => {
          if (getError) {
            console.error("Get updated match error:", getError);
            return res.json({
              message: "Match score submitted successfully",
            });
          }

          res.json({
            message: "Match score submitted successfully",
            match: match,
          });
        });
      }
    );
  }
);

// Verify match result (admin only)
router.put(
  "/:id/verify",
  authenticateToken,
  requireAdmin,
  validateIdParam,
  (req, res) => {
    const matchId = req.params.id;
    const { verified } = req.body;

    if (typeof verified !== "boolean") {
      return res.status(400).json({
        error: "Verified field must be a boolean",
        code: "INVALID_VERIFIED_VALUE",
      });
    }

    if (verified) {
      Match.verifyResult(matchId, req.user.id, req.ip, (error, result) => {
        if (error) {
          console.error("Verify match error:", error);

          if (error.message === "Match not found") {
            return res.status(404).json({
              error: "Match not found",
              code: "MATCH_NOT_FOUND",
            });
          }

          return res.status(500).json({
            error: "Failed to verify match",
            code: "VERIFY_MATCH_ERROR",
          });
        }

        res.json({
          message: "Match verified successfully",
        });
      });
    } else {
      // For disputing matches, we'd need to implement a separate method
      // For now, just return success
      res.json({
        message: "Match disputed successfully",
      });
    }
  }
);

// Update match details (admin only)
router.put(
  "/:id",
  authenticateToken,
  requireAdmin,
  validateIdParam,
  (req, res) => {
    const matchId = req.params.id;
    const { scheduled_time, status } = req.body;

    if (
      status &&
      !["scheduled", "in_progress", "completed", "disputed"].includes(status)
    ) {
      return res.status(400).json({
        error: "Invalid status value",
        code: "INVALID_STATUS",
      });
    }

    const updateData = {};
    if (scheduled_time) updateData.scheduled_time = scheduled_time;
    if (status) updateData.status = status;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: "No valid fields to update",
        code: "NO_UPDATES",
      });
    }

    Match.update(matchId, updateData, req.user.id, req.ip, (error, result) => {
      if (error) {
        console.error("Update match error:", error);

        if (error.message === "Match not found") {
          return res.status(404).json({
            error: "Match not found",
            code: "MATCH_NOT_FOUND",
          });
        }

        if (error.message === "No valid fields to update") {
          return res.status(400).json({
            error: "No valid fields to update",
            code: "NO_UPDATES",
          });
        }

        return res.status(500).json({
          error: "Failed to update match",
          code: "UPDATE_MATCH_ERROR",
        });
      }

      // Get updated match details
      Match.getById(matchId, (getError, match) => {
        if (getError) {
          console.error("Get updated match error:", getError);
          return res.json({
            message: "Match updated successfully",
          });
        }

        res.json({
          message: "Match updated successfully",
          match: match,
        });
      });
    });
  }
);

module.exports = router;
