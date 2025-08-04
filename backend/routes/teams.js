const express = require("express");
const { logAudit } = require("../config/database");
const Team = require("../models/Team");
const {
  authenticateToken,
  requireTeamOwnership,
  optionalAuth,
} = require("../middleware/auth");
const {
  validateTeamCreation,
  validateTeamUpdate,
  validateIdParam,
  validatePagination,
  sanitizeInput,
} = require("../middleware/validation");

const router = express.Router();

// Apply input sanitization to all routes
router.use(sanitizeInput);

// Get all teams (public endpoint with optional auth for additional info)
router.get("/", optionalAuth, validatePagination, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const search = req.query.q || "";

  const options = {
    page,
    limit,
    search,
    isActive: true,
  };

  Team.getAll(options, (error, result) => {
    if (error) {
      console.error("Get teams error:", error);
      return res.status(500).json({
        error: "Failed to get teams",
        code: "GET_TEAMS_ERROR",
      });
    }

    res.json(result);
  });
});

// Create new team
router.post("/", authenticateToken, validateTeamCreation, (req, res) => {
  const { name } = req.body;
  const captainId = req.user.id;

  Team.create(name, captainId, req.ip, (error, result) => {
    if (error) {
      console.error("Create team error:", error);

      if (error.code === "ALREADY_CAPTAIN") {
        return res.status(409).json({
          error: "You are already a captain of another team",
          code: "ALREADY_CAPTAIN",
        });
      }

      if (error.code === "TEAM_NAME_TAKEN") {
        return res.status(409).json({
          error: "Team name already taken",
          code: "TEAM_NAME_TAKEN",
        });
      }

      return res.status(500).json({
        error: "Failed to create team",
        code: "CREATE_TEAM_ERROR",
      });
    }

    res.status(201).json({
      message: "Team created successfully",
      team: result,
    });
  });
});

// Get team by ID
router.get("/:id", optionalAuth, validateIdParam, (req, res) => {
  const teamId = req.params.id;

  Team.getById(teamId, (error, team) => {
    if (error) {
      console.error("Get team error:", error);
      return res.status(500).json({
        error: "Failed to get team",
        code: "GET_TEAM_ERROR",
      });
    }

    if (!team) {
      return res.status(404).json({
        error: "Team not found",
        code: "TEAM_NOT_FOUND",
      });
    }

    // Get team members
    Team.getMembers(teamId, (error, members) => {
      if (error) {
        console.error("Get team members error:", error);
        return res.status(500).json({
          error: "Failed to get team members",
          code: "GET_TEAM_MEMBERS_ERROR",
        });
      }

      // Hide sensitive info if not authenticated or not team member/admin
      const isTeamMember =
        req.user && members.some((m) => m.id === req.user.id);
      const isAdmin = req.user && req.user.role === "admin";

      if (!isTeamMember && !isAdmin) {
        // Remove email addresses for non-members
        members.forEach((member) => {
          delete member.email;
        });
        delete team.captain_email;
      }

      res.json({
        team: {
          ...team,
          members,
        },
      });
    });
  });
});

// Update team (captain only)
router.put(
  "/:id",
  authenticateToken,
  requireTeamOwnership,
  validateIdParam,
  validateTeamUpdate,
  (req, res) => {
    const teamId = req.params.id;
    const { name, is_active } = req.body;
    const updates = { name, is_active };

    Team.update(teamId, updates, req.user.id, req.ip, (error, result) => {
      if (error) {
        console.error("Update team error:", error);

        if (error.code === "TEAM_NAME_TAKEN") {
          return res.status(409).json({
            error: "Team name already taken",
            code: "TEAM_NAME_TAKEN",
          });
        }

        if (error.code === "NO_UPDATES") {
          return res.status(400).json({
            error: "No valid fields to update",
            code: "NO_UPDATES",
          });
        }

        return res.status(500).json({
          error: "Failed to update team",
          code: "UPDATE_TEAM_ERROR",
        });
      }

      res.json({
        message: "Team updated successfully",
        team: result,
      });
    });
  }
);

// Join team request
router.post("/:id/join", authenticateToken, validateIdParam, (req, res) => {
  const teamId = req.params.id;
  const userId = req.user.id;

  Team.addMember(teamId, userId, null, req.ip, (error, result) => {
    if (error) {
      console.error("Join team error:", error);

      if (error.code === "TEAM_NOT_FOUND") {
        return res.status(404).json({
          error: "Team not found or inactive",
          code: "TEAM_NOT_FOUND",
        });
      }

      if (error.code === "ALREADY_MEMBER") {
        return res.status(409).json({
          error: "You are already a member of this team",
          code: "ALREADY_MEMBER",
        });
      }

      if (error.code === "REQUEST_PENDING") {
        return res.status(409).json({
          error: "You already have a pending request for this team",
          code: "REQUEST_PENDING",
        });
      }

      if (error.code === "CAPTAIN_CANNOT_JOIN") {
        return res.status(409).json({
          error: "Team captains cannot join other teams",
          code: "CAPTAIN_CANNOT_JOIN",
        });
      }

      return res.status(500).json({
        error: "Failed to join team",
        code: "JOIN_TEAM_ERROR",
      });
    }

    res.json({
      message: "Join request submitted successfully",
    });
  });
});

// Approve/reject join request (captain only)
router.put(
  "/:id/members/:userId",
  authenticateToken,
  requireTeamOwnership,
  validateIdParam,
  (req, res) => {
    const teamId = req.params.id;
    const userId = req.params.userId;
    const { action } = req.body; // 'approve' or 'reject'

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        error: "Action must be approve or reject",
        code: "INVALID_ACTION",
      });
    }

    if (action === "approve") {
      Team.acceptMember(
        teamId,
        userId,
        req.user.id,
        req.ip,
        (error, result) => {
          if (error) {
            console.error("Accept member error:", error);

            if (error.code === "REQUEST_NOT_FOUND") {
              return res.status(404).json({
                error: "Join request not found",
                code: "REQUEST_NOT_FOUND",
              });
            }

            return res.status(500).json({
              error: "Failed to accept member",
              code: "ACCEPT_MEMBER_ERROR",
            });
          }

          res.json({
            message: "Join request approved successfully",
          });
        }
      );
    } else {
      Team.removeMember(
        teamId,
        userId,
        req.user.id,
        req.ip,
        (error, result) => {
          if (error) {
            console.error("Remove member error:", error);

            if (error.code === "REQUEST_NOT_FOUND") {
              return res.status(404).json({
                error: "Join request not found",
                code: "REQUEST_NOT_FOUND",
              });
            }

            return res.status(500).json({
              error: "Failed to reject member",
              code: "REJECT_MEMBER_ERROR",
            });
          }

          res.json({
            message: "Join request rejected successfully",
          });
        }
      );
    }
  }
);

module.exports = router;
