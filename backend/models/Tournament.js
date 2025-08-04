const { logAudit } = require("../config/database");

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

class Tournament {
  // Get all tournaments with pagination and filters
  static getAll(options = {}, callback) {
    const {
      page = 1,
      limit = 20,
      search = "",
      status = "",
      game = "",
      userId = null,
    } = options;

    const offset = (page - 1) * limit;
    let query = `
            SELECT t.id, t.name, t.game, t.start_date, t.end_date, t.status, 
                   t.max_teams, t.created_at, t.updated_at,
                   u.username as created_by_username,
                   COUNT(DISTINCT tm.team_id) as registered_teams
            FROM tournaments t
            JOIN users u ON t.created_by = u.id
            LEFT JOIN (
                SELECT DISTINCT team1_id as team_id, tournament_id FROM matches
                UNION
                SELECT DISTINCT team2_id as team_id, tournament_id FROM matches
            ) tm ON t.id = tm.tournament_id
            WHERE 1=1
        `;

    let countQuery = "SELECT COUNT(*) as total FROM tournaments t WHERE 1=1";
    let queryParams = [];

    if (search) {
      query += " AND t.name LIKE ?";
      countQuery += " AND t.name LIKE ?";
      queryParams.push(`%${search}%`);
    }

    if (status) {
      query += " AND t.status = ?";
      countQuery += " AND t.status = ?";
      queryParams.push(status);
    }

    if (game) {
      query += " AND t.game LIKE ?";
      countQuery += " AND t.game LIKE ?";
      queryParams.push(`%${game}%`);
    }

    query += " GROUP BY t.id ORDER BY t.start_date DESC LIMIT ? OFFSET ?";
    queryParams.push(limit, offset);

    const connection = createConnection();
    connection.query(query, queryParams, (error, tournaments) => {
      if (error) {
        connection.end();
        return callback(error, null);
      }

      // Get count
      const countParams = queryParams.slice(0, -2);
      connection.query(countQuery, countParams, (countError, countResult) => {
        connection.end();
        if (countError) {
          return callback(countError, null);
        }

        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        const result = {
          tournaments,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        };

        callback(null, result);
      });
    });
  }

  // Get tournament by ID
  static getById(id, callback) {
    const connection = createConnection();
    connection.query(
      `
            SELECT t.*, u.username as created_by_username,
                   COUNT(DISTINCT tm.team_id) as registered_teams
            FROM tournaments t
            JOIN users u ON t.created_by = u.id
            LEFT JOIN (
                SELECT DISTINCT team1_id as team_id, tournament_id FROM matches
                UNION
                SELECT DISTINCT team2_id as team_id, tournament_id FROM matches
            ) tm ON t.id = tm.tournament_id
            WHERE t.id = ?
            GROUP BY t.id
        `,
      [id],
      (error, rows) => {
        connection.end();
        if (error) {
          return callback(error, null);
        }
        callback(null, rows[0]);
      }
    );
  }

  // Create new tournament
  static create(tournamentData, userId, ipAddress = "127.0.0.1", callback) {
    const {
      name,
      game,
      start_date,
      end_date,
      max_teams = 16,
      status = "draft",
    } = tournamentData;

    const connection = createConnection();

    // Check if tournament name already exists
    connection.query(
      "SELECT id FROM tournaments WHERE name = ?",
      [name],
      (error, existing) => {
        if (error) {
          connection.end();
          return callback(error, null);
        }

        if (existing.length > 0) {
          connection.end();
          return callback(new Error("Tournament name already exists"), null);
        }

        // Insert new tournament
        connection.query(
          `
                INSERT INTO tournaments (name, game, start_date, end_date, max_teams, status, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
          [name, game, start_date, end_date, max_teams, status, userId],
          (insertError, result) => {
            if (insertError) {
              connection.end();
              return callback(insertError, null);
            }

            const tournamentId = result.insertId;

            // Log audit
            logAudit(
              userId,
              "CREATE",
              "tournaments",
              tournamentId,
              null,
              tournamentData,
              ipAddress
            )
              .then(() => {
                connection.end();
                callback(null, tournamentId);
              })
              .catch((auditError) => {
                connection.end();
                callback(auditError, null);
              });
          }
        );
      }
    );
  } // Update tournament
  static update(id, updateData, userId, ipAddress = "127.0.0.1", callback) {
    // First get the old data
    this.getById(id, (getError, oldData) => {
      if (getError) {
        return callback(getError, null);
      }

      if (!oldData) {
        return callback(new Error("Tournament not found"), null);
      }

      const allowedFields = [
        "name",
        "game",
        "start_date",
        "end_date",
        "max_teams",
        "status",
      ];
      const updates = [];
      const values = [];

      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(updateData[field]);
        }
      }

      if (updates.length === 0) {
        return callback(new Error("No valid fields to update"), null);
      }

      values.push(id);
      const connection = createConnection();
      connection.query(
        `
            UPDATE tournaments SET ${updates.join(
              ", "
            )}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `,
        values,
        (updateError, result) => {
          if (updateError) {
            connection.end();
            return callback(updateError, null);
          }

          if (result.affectedRows === 0) {
            connection.end();
            return callback(new Error("Tournament not found"), null);
          }

          // Log audit
          logAudit(
            userId,
            "UPDATE",
            "tournaments",
            id,
            oldData,
            updateData,
            ipAddress
          )
            .then(() => {
              connection.end();
              callback(null, true);
            })
            .catch((auditError) => {
              connection.end();
              callback(auditError, null);
            });
        }
      );
    });
  }

  // Delete tournament (soft delete by setting status to cancelled)
  static delete(id, userId, ipAddress = "127.0.0.1", callback) {
    // First get the old data
    this.getById(id, (getError, oldData) => {
      if (getError) {
        return callback(getError, null);
      }

      if (!oldData) {
        return callback(new Error("Tournament not found"), null);
      }

      const connection = createConnection();
      connection.query(
        `
            UPDATE tournaments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `,
        [id],
        (updateError, result) => {
          if (updateError) {
            connection.end();
            return callback(updateError, null);
          }

          if (result.affectedRows === 0) {
            connection.end();
            return callback(new Error("Tournament not found"), null);
          }

          // Log audit
          logAudit(
            userId,
            "DELETE",
            "tournaments",
            id,
            oldData,
            { status: "cancelled" },
            ipAddress
          )
            .then(() => {
              connection.end();
              callback(null, true);
            })
            .catch((auditError) => {
              connection.end();
              callback(auditError, null);
            });
        }
      );
    });
  }

  // Get tournaments by status
  static getByStatus(status, callback) {
    const connection = createConnection();
    connection.query(
      `
        SELECT t.*, u.username as created_by_username
        FROM tournaments t
        JOIN users u ON t.created_by = u.id
        WHERE t.status = ?
        ORDER BY t.start_date DESC
    `,
      [status],
      (error, rows) => {
        connection.end();
        if (error) {
          return callback(error, null);
        }
        callback(null, rows);
      }
    );
  }

  // Get active tournaments
  static getActive(callback) {
    this.getByStatus("active", callback);
  }

  // Check if user can register for tournament
  static canRegister(tournamentId, userId, callback) {
    this.getById(tournamentId, (getError, tournament) => {
      if (getError) {
        return callback(getError, null);
      }

      if (!tournament || tournament.status !== "active") {
        return callback(null, false);
      }

      // Check if user has teams
      const connection = createConnection();
      connection.query(
        `
            SELECT t.id FROM teams t
            JOIN team_members tm ON t.id = tm.team_id
            WHERE tm.user_id = ? AND tm.status = 'active' AND t.is_active = TRUE
        `,
        [userId],
        (teamsError, teams) => {
          connection.end();
          if (teamsError) {
            return callback(teamsError, null);
          }
          callback(null, teams.length > 0);
        }
      );
    });
  }

  // Get tournament statistics
  static getStats(tournamentId, callback) {
    const connection = createConnection();
    connection.query(
      `
        SELECT 
            COUNT(DISTINCT m.id) as total_matches,
            COUNT(DISTINCT CASE WHEN m.status = 'completed' THEN m.id END) as completed_matches,
            COUNT(DISTINCT CASE WHEN m.status = 'in_progress' THEN m.id END) as in_progress_matches,
            COUNT(DISTINCT tm.team_id) as registered_teams
        FROM tournaments t
        LEFT JOIN matches m ON t.id = m.tournament_id
        LEFT JOIN (
            SELECT DISTINCT team1_id as team_id, tournament_id FROM matches
            UNION
            SELECT DISTINCT team2_id as team_id, tournament_id FROM matches
        ) tm ON t.id = tm.tournament_id
        WHERE t.id = ?
    `,
      [tournamentId],
      (error, stats) => {
        connection.end();
        if (error) {
          return callback(error, null);
        }
        callback(null, stats[0]);
      }
    );
  }
}

module.exports = Tournament;
