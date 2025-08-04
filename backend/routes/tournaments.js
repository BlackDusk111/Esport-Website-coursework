const express = require("express");
const { Tournament } = require("../models");
const { promisePool, logAudit } = require("../config/database");
const {
  authenticateToken,
  requireAdmin,
  requireTournamentOwnership,
  optionalAuth,
} = require("../middleware/auth");
const {
  validateTournamentCreation,
  validateIdParam,
  validatePagination,
  sanitizeInput,
} = require("../middleware/validation");

const router = express.Router();

// Helper function to create database connection
function createConnection() {
  const mysql = require("mysql2");
  return mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "hackerXdata0005hackedX",
    database: process.env.DB_NAME || "esports_tournament",
  });
}

// Apply input sanitization to all routes
router.use(sanitizeInput);

// Get all tournaments (public endpoint with optional auth)
router.get("/", optionalAuth, validatePagination, async (req, res) => {
  try {
    // Check if database is connected
    if (!req.dbConnected) {
      // Return mock data for development
      const mockTournaments = [
        {
          id: 1,
          name: "Summer Gaming Championship",
          game: "League of Legends",
          start_date: "2024-06-15T10:00:00Z",
          end_date: "2024-06-20T18:00:00Z",
          status: "active",
          max_teams: 16,
          registered_teams: 8,
          created_by_username: "admin",
        },
        {
          id: 2,
          name: "CS:GO Pro League",
          game: "Counter-Strike: Global Offensive",
          start_date: "2024-07-01T14:00:00Z",
          end_date: "2024-07-10T22:00:00Z",
          status: "upcoming",
          max_teams: 32,
          registered_teams: 12,
          created_by_username: "admin",
        },
      ];

      return res.json({
        tournaments: mockTournaments,
        pagination: {
          page: parseInt(req.query.page) || 1,
          limit: parseInt(req.query.limit) || 20,
          total: mockTournaments.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });
    }

    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      search: req.query.q || "",
      status: req.query.status || "",
      game: req.query.game || "",
      userId: req.user?.id,
    };

    Tournament.getAll(options, (error, result) => {
      if (error) {
        console.error("Get tournaments error:", error);
        return res.status(500).json({
          error: "Failed to get tournaments",
          code: "GET_TOURNAMENTS_ERROR",
        });
      }
      res.json(result);
    });
  } catch (error) {
    console.error("Get tournaments error:", error);
    res.status(500).json({
      error: "Failed to get tournaments",
      code: "GET_TOURNAMENTS_ERROR",
    });
  }
});

// Create new tournament (admin only)
router.post(
  "/",
  // authenticateToken,
  //   requireAdmin,
  validateTournamentCreation,
  async (req, res) => {
    try {
      Tournament.create(
        req.body,
        req.user.id,
        req.ip,
        (createError, tournamentId) => {
          if (createError) {
            console.error("Create tournament error:", createError);

            if (createError.message === "Tournament name already exists") {
              return res.status(409).json({
                error: createError.message,
                code: "TOURNAMENT_NAME_TAKEN",
              });
            }

            return res.status(500).json({
              error: "Failed to create tournament",
              code: "CREATE_TOURNAMENT_ERROR",
            });
          }

          Tournament.getById(tournamentId, (getError, tournament) => {
            if (getError) {
              console.error("Get created tournament error:", getError);
              return res.status(500).json({
                error: "Tournament created but failed to retrieve details",
                code: "GET_TOURNAMENT_ERROR",
              });
            }

            res.status(201).json({
              message: "Tournament created successfully",
              tournament,
            });
          });
        }
      );
    } catch (error) {
      console.error("Create tournament error:", error);

      if (error.message === "Tournament name already exists") {
        return res.status(409).json({
          error: error.message,
          code: "TOURNAMENT_NAME_TAKEN",
        });
      }

      res.status(500).json({
        error: "Failed to create tournament",
        code: "CREATE_TOURNAMENT_ERROR",
      });
    }
  }
);

// Get tournament by ID
router.get("/:id", optionalAuth, validateIdParam, async (req, res) => {
  try {
    const tournamentId = req.params.id;
    Tournament.getById(tournamentId, async (getError, tournament) => {
      if (getError) {
        console.error("Get tournament error:", getError);
        return res.status(500).json({
          error: "Failed to get tournament",
          code: "GET_TOURNAMENT_ERROR",
        });
      }

      if (!tournament) {
        return res.status(404).json({
          error: "Tournament not found",
          code: "TOURNAMENT_NOT_FOUND",
        });
      }

      try {
        // Get tournament matches
        const { Match } = require("../models");
        const matches = await Match.getByTournament(tournamentId);

        // Get registered teams
        const { Team } = require("../models");
        const registeredTeams = await Team.getByTournament(tournamentId);

        // Hide sensitive info if not admin or tournament creator
        const isAdmin = req.user && req.user.role === "admin";
        const isCreator = req.user && req.user.id === tournament.created_by;

        if (!isAdmin && !isCreator) {
          delete tournament.created_by;
        }

        res.json({
          tournament: {
            ...tournament,
            matches,
            registered_teams: registeredTeams,
          },
        });
      } catch (relatedDataError) {
        console.error("Get tournament related data error:", relatedDataError);
        res.status(500).json({
          error: "Failed to get tournament details",
          code: "GET_TOURNAMENT_ERROR",
        });
      }
    });
  } catch (error) {
    console.error("Get tournament error:", error);
    res.status(500).json({
      error: "Failed to get tournament",
      code: "GET_TOURNAMENT_ERROR",
    });
  }
});

// Update tournament (admin or creator only)
router.put(
  "/:id",
  authenticateToken,
  requireTournamentOwnership,
  validateIdParam,
  async (req, res) => {
    try {
      const tournamentId = req.params.id;
      const { name, game, start_date, end_date, max_teams, status } = req.body;

      // Get current tournament data
      const connection = createConnection();
      connection.query(
        "SELECT name, game, start_date, end_date, max_teams, status FROM tournaments WHERE id = ?",
        [tournamentId],
        (error, currentTournaments) => {
          if (error) {
            connection.end();
            console.error("Database error:", error);
            return res.status(500).json({
              error: "Failed to get current tournament data",
              code: "DATABASE_ERROR",
            });
          }

          if (currentTournaments.length === 0) {
            connection.end();
            return res.status(404).json({
              error: "Tournament not found",
              code: "TOURNAMENT_NOT_FOUND",
            });
          }

          const oldValues = currentTournaments[0];
          const updateFields = [];
          const updateValues = [];

          // Continue with the rest of the logic inside the callback
          if (name && name !== oldValues.name) {
            // Check if new name is already taken
            const connection2 = createConnection();
            connection2.query(
              "SELECT id FROM tournaments WHERE name = ? AND id != ?",
              [name, tournamentId],
              (error2, existingNames) => {
                connection2.end();
                if (error2) {
                  connection.end();
                  console.error("Database error:", error2);
                  return res.status(500).json({
                    error: "Failed to check tournament name",
                    code: "DATABASE_ERROR",
                  });
                }

                if (existingNames.length > 0) {
                  connection.end();
                  return res.status(409).json({
                    error: "Tournament name already taken",
                    code: "TOURNAMENT_NAME_TAKEN",
                  });
                }

                updateFields.push("name = ?");
                updateValues.push(name);
                continueUpdate();
              }
            );
          } else {
            continueUpdate();
          }

          function continueUpdate() {
            if (game && game !== oldValues.game) {
              updateFields.push("game = ?");
              updateValues.push(game);
            }

            if (start_date && start_date !== oldValues.start_date) {
              updateFields.push("start_date = ?");
              updateValues.push(start_date);
            }

            if (end_date && end_date !== oldValues.end_date) {
              updateFields.push("end_date = ?");
              updateValues.push(end_date);
            }

            if (max_teams && max_teams !== oldValues.max_teams) {
              updateFields.push("max_teams = ?");
              updateValues.push(max_teams);
            }

            if (status && status !== oldValues.status) {
              updateFields.push("status = ?");
              updateValues.push(status);
            }

            if (updateFields.length === 0) {
              connection.end();
              return res.status(400).json({
                error: "No valid fields to update",
                code: "NO_UPDATES",
              });
            }

            updateFields.push("updated_at = NOW()");
            updateValues.push(tournamentId);

            // Update tournament
            connection.query(
              `UPDATE tournaments SET ${updateFields.join(", ")} WHERE id = ?`,
              updateValues,
              (error3, updateResult) => {
                if (error3) {
                  connection.end();
                  console.error("Database error:", error3);
                  return res.status(500).json({
                    error: "Failed to update tournament",
                    code: "DATABASE_ERROR",
                  });
                }

                // Get updated tournament data
                connection.query(
                  `SELECT t.id, t.name, t.game, t.start_date, t.end_date, t.status, 
                                        t.max_teams, t.created_at, t.updated_at,
                                        u.username as created_by_username
                                 FROM tournaments t
                                 JOIN users u ON t.created_by = u.id
                                 WHERE t.id = ?`,
                  [tournamentId],
                  async (error4, updatedTournaments) => {
                    connection.end();
                    if (error4) {
                      console.error("Database error:", error4);
                      return res.status(500).json({
                        error: "Failed to fetch updated tournament",
                        code: "DATABASE_ERROR",
                      });
                    }

                    // Log the update
                    try {
                      await logAudit(
                        req.user.id,
                        "UPDATE",
                        "tournaments",
                        tournamentId,
                        oldValues,
                        {
                          name: updatedTournaments[0].name,
                          game: updatedTournaments[0].game,
                          start_date: updatedTournaments[0].start_date,
                          end_date: updatedTournaments[0].end_date,
                          max_teams: updatedTournaments[0].max_teams,
                          status: updatedTournaments[0].status,
                        },
                        req.ip
                      );

                      res.json({
                        message: "Tournament updated successfully",
                        tournament: updatedTournaments[0],
                      });
                    } catch (auditError) {
                      console.error("Audit log error:", auditError);
                      res.json({
                        message: "Tournament updated successfully",
                        tournament: updatedTournaments[0],
                      });
                    }
                  }
                );
              }
            );
          }
        }
      );
    } catch (error) {
      console.error("Update tournament error:", error);
      res.status(500).json({
        error: "Failed to update tournament",
        code: "UPDATE_TOURNAMENT_ERROR",
      });
    }
  }
);

// Register team for tournament
router.post(
  "/:id/register",
  authenticateToken,
  validateIdParam,
  async (req, res) => {
    try {
      const tournamentId = req.params.id;
      const { team_id } = req.body;

      if (!team_id) {
        return res.status(400).json({
          error: "Team ID is required",
          code: "TEAM_ID_REQUIRED",
        });
      }

      // Check if tournament exists and is active
      const connection1 = createConnection();
      connection1.query(
        "SELECT id, name, status, max_teams FROM tournaments WHERE id = ? AND status = ?",
        [tournamentId, "active"],
        (error1, tournaments) => {
          connection1.end();
          if (error1) {
            console.error("Database error:", error1);
            return res.status(500).json({
              error: "Failed to check tournament",
              code: "DATABASE_ERROR",
            });
          }

          if (tournaments.length === 0) {
            return res.status(404).json({
              error: "Tournament not found or not active",
              code: "TOURNAMENT_NOT_ACTIVE",
            });
          }

          // Check if user is captain of the team
          const connection2 = createConnection();
          connection2.query(
            "SELECT id, name FROM teams WHERE id = ? AND captain_id = ? AND is_active = TRUE",
            [team_id, req.user.id],
            (error2, teams) => {
              connection2.end();
              if (error2) {
                console.error("Database error:", error2);
                return res.status(500).json({
                  error: "Failed to check team",
                  code: "DATABASE_ERROR",
                });
              }

              if (teams.length === 0) {
                return res.status(403).json({
                  error:
                    "You are not the captain of this team or team is inactive",
                  code: "NOT_TEAM_CAPTAIN",
                });
              }

              // Check if team is already registered
              const connection3 = createConnection();
              connection3.query(
                "SELECT id FROM matches WHERE tournament_id = ? AND (team1_id = ? OR team2_id = ?)",
                [tournamentId, team_id, team_id],
                (error3, existingMatches) => {
                  connection3.end();
                  if (error3) {
                    console.error("Database error:", error3);
                    return res.status(500).json({
                      error: "Failed to check existing registration",
                      code: "DATABASE_ERROR",
                    });
                  }

                  if (existingMatches.length > 0) {
                    return res.status(409).json({
                      error: "Team is already registered for this tournament",
                      code: "TEAM_ALREADY_REGISTERED",
                    });
                  }

                  // Check tournament capacity
                  const connection4 = createConnection();
                  connection4.query(
                    `SELECT COUNT(DISTINCT 
                                        CASE WHEN team1_id IS NOT NULL THEN team1_id END +
                                        CASE WHEN team2_id IS NOT NULL THEN team2_id END
                                    ) as count FROM matches WHERE tournament_id = ?`,
                    [tournamentId],
                    async (error4, registeredCount) => {
                      connection4.end();
                      if (error4) {
                        console.error("Database error:", error4);
                        return res.status(500).json({
                          error: "Failed to check tournament capacity",
                          code: "DATABASE_ERROR",
                        });
                      }

                      if (
                        registeredCount[0].count >= tournaments[0].max_teams
                      ) {
                        return res.status(409).json({
                          error: "Tournament is full",
                          code: "TOURNAMENT_FULL",
                        });
                      }

                      // For now, just log the registration - actual match creation would be handled by tournament bracket generation
                      try {
                        await logAudit(
                          req.user.id,
                          "REGISTER_TEAM",
                          "tournaments",
                          tournamentId,
                          null,
                          {
                            team_id,
                            tournament_id: tournamentId,
                          },
                          req.ip
                        );

                        res.json({
                          message:
                            "Team registered for tournament successfully",
                        });
                      } catch (auditError) {
                        console.error("Audit log error:", auditError);
                        res.json({
                          message:
                            "Team registered for tournament successfully",
                        });
                      }
                    }
                  );
                }
              );
            }
          );
        }
      );
    } catch (error) {
      console.error("Register team error:", error);
      res.status(500).json({
        error: "Failed to register team",
        code: "REGISTER_TEAM_ERROR",
      });
    }
  }
);

module.exports = router;
