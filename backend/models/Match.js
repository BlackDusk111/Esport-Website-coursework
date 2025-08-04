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

class Match {
  // Get all matches with pagination and filters
  static getAll(options = {}, callback) {
    const {
      page = 1,
      limit = 20,
      tournamentId = null,
      status = "",
      teamId = null,
      userId = null,
    } = options;

    const offset = (page - 1) * limit;
    let query = `
            SELECT m.*, 
                   t1.name as team1_name, t2.name as team2_name,
                   tour.name as tournament_name,
                   u.username as submitted_by_username,
                   admin.username as verified_by_username
            FROM matches m
            JOIN teams t1 ON m.team1_id = t1.id
            JOIN teams t2 ON m.team2_id = t2.id
            JOIN tournaments tour ON m.tournament_id = tour.id
            LEFT JOIN users u ON m.submitted_by_user_id = u.id
            LEFT JOIN users admin ON m.verified_by_admin_id = admin.id
            WHERE 1=1
        `;

    let countQuery = `
            SELECT COUNT(*) as total FROM matches m
            JOIN teams t1 ON m.team1_id = t1.id
            JOIN teams t2 ON m.team2_id = t2.id
            JOIN tournaments tour ON m.tournament_id = tour.id
            WHERE 1=1
        `;

    let queryParams = [];

    if (tournamentId) {
      query += " AND m.tournament_id = ?";
      countQuery += " AND m.tournament_id = ?";
      queryParams.push(tournamentId);
    }

    if (status) {
      query += " AND m.status = ?";
      countQuery += " AND m.status = ?";
      queryParams.push(status);
    }

    if (teamId) {
      query += " AND (m.team1_id = ? OR m.team2_id = ?)";
      countQuery += " AND (m.team1_id = ? OR m.team2_id = ?)";
      queryParams.push(teamId, teamId);
    }

    query += " ORDER BY m.scheduled_time DESC LIMIT ? OFFSET ?";
    queryParams.push(limit, offset);

    const connection = createConnection();
    connection.query(query, queryParams, (error, matches) => {
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
          matches,
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

  // Get match by ID
  static getById(id, callback) {
    const connection = createConnection();
    connection.query(
      `
            SELECT m.*, 
                   t1.name as team1_name, t2.name as team2_name,
                   tour.name as tournament_name,
                   u.username as submitted_by_username,
                   admin.username as verified_by_username
            FROM matches m
            JOIN teams t1 ON m.team1_id = t1.id
            JOIN teams t2 ON m.team2_id = t2.id
            JOIN tournaments tour ON m.tournament_id = tour.id
            LEFT JOIN users u ON m.submitted_by_user_id = u.id
            LEFT JOIN users admin ON m.verified_by_admin_id = admin.id
            WHERE m.id = ?
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

  // Create new match
  static create(matchData, userId, ipAddress = "127.0.0.1", callback) {
    const {
      tournament_id,
      team1_id,
      team2_id,
      scheduled_time,
      status = "scheduled",
    } = matchData;

    // Validate teams are different
    if (team1_id === team2_id) {
      return callback(new Error("Teams must be different"), null);
    }

    // Check if tournament exists and is active
    const connection = createConnection();
    connection.query(
      "SELECT status FROM tournaments WHERE id = ?",
      [tournament_id],
      (error, tournament) => {
        if (error) {
          connection.end();
          return callback(error, null);
        }

        if (tournament.length === 0) {
          connection.end();
          return callback(new Error("Tournament not found"), null);
        }

        if (tournament[0].status !== "active") {
          connection.end();
          return callback(new Error("Tournament is not active"), null);
        }

        // Insert match
        connection.query(
          `
                    INSERT INTO matches (tournament_id, team1_id, team2_id, scheduled_time, status)
                    VALUES (?, ?, ?, ?, ?)
                `,
          [tournament_id, team1_id, team2_id, scheduled_time, status],
          (insertError, result) => {
            connection.end();
            if (insertError) {
              return callback(insertError, null);
            }

            const matchId = result.insertId;

            // Log audit
            logAudit(
              userId,
              "CREATE",
              "matches",
              matchId,
              null,
              matchData,
              ipAddress
            )
              .then(() => callback(null, matchId))
              .catch((auditError) => callback(null, matchId)); // Don't fail on audit error
          }
        );
      }
    );
  }

  // Update match
  static update(id, updateData, userId, ipAddress = "127.0.0.1", callback) {
    this.getById(id, (error, oldData) => {
      if (error) {
        return callback(error, null);
      }

      if (!oldData) {
        return callback(new Error("Match not found"), null);
      }

      const allowedFields = ["scheduled_time", "score1", "score2", "status"];
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
                UPDATE matches SET ${updates.join(
                  ", "
                )}, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `,
        values,
        (updateError, result) => {
          connection.end();
          if (updateError) {
            return callback(updateError, null);
          }

          if (result.affectedRows === 0) {
            return callback(new Error("Match not found"), null);
          }

          // Log audit
          logAudit(
            userId,
            "UPDATE",
            "matches",
            id,
            oldData,
            updateData,
            ipAddress
          )
            .then(() => callback(null, true))
            .catch((auditError) => callback(null, true)); // Don't fail on audit error
        }
      );
    });
  }

  // Submit match result
  static submitResult(
    id,
    resultData,
    userId,
    ipAddress = "127.0.0.1",
    callback
  ) {
    const { score1, score2 } = resultData;

    // Validate scores
    if (score1 < 0 || score2 < 0) {
      return callback(new Error("Scores must be non-negative"), null);
    }

    const connection = createConnection();
    connection.query(
      `
            UPDATE matches 
            SET score1 = ?, score2 = ?, status = 'completed', 
                submitted_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `,
      [score1, score2, userId, id],
      (error, result) => {
        connection.end();
        if (error) {
          return callback(error, null);
        }

        if (result.affectedRows === 0) {
          return callback(new Error("Match not found"), null);
        }

        // Log audit
        logAudit(
          userId,
          "SUBMIT_RESULT",
          "matches",
          id,
          null,
          resultData,
          ipAddress
        )
          .then(() => callback(null, true))
          .catch((auditError) => callback(null, true)); // Don't fail on audit error
      }
    );
  }

  // Verify match result (admin only)
  static verifyResult(id, adminId, ipAddress = "127.0.0.1", callback) {
    const connection = createConnection();
    connection.query(
      `
            UPDATE matches 
            SET verified_by_admin_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `,
      [adminId, id],
      (error, result) => {
        connection.end();
        if (error) {
          return callback(error, null);
        }

        if (result.affectedRows === 0) {
          return callback(new Error("Match not found"), null);
        }

        // Log audit
        logAudit(
          adminId,
          "VERIFY_RESULT",
          "matches",
          id,
          null,
          { verified: true },
          ipAddress
        )
          .then(() => callback(null, true))
          .catch((auditError) => callback(null, true)); // Don't fail on audit error
      }
    );
  }

  // Get matches by tournament
  static getByTournament(tournamentId, callback) {
    const connection = createConnection();
    connection.query(
      `
            SELECT m.*, 
                   t1.name as team1_name, t2.name as team2_name,
                   u.username as submitted_by_username,
                   admin.username as verified_by_username
            FROM matches m
            JOIN teams t1 ON m.team1_id = t1.id
            JOIN teams t2 ON m.team2_id = t2.id
            LEFT JOIN users u ON m.submitted_by_user_id = u.id
            LEFT JOIN users admin ON m.verified_by_admin_id = admin.id
            WHERE m.tournament_id = ?
            ORDER BY m.scheduled_time ASC
        `,
      [tournamentId],
      (error, rows) => {
        connection.end();
        if (error) {
          return callback(error, null);
        }
        callback(null, rows);
      }
    );
  }

  // Get matches by team
  static getByTeam(teamId, callback) {
    const connection = createConnection();
    connection.query(
      `
            SELECT m.*, 
                   t1.name as team1_name, t2.name as team2_name,
                   tour.name as tournament_name,
                   u.username as submitted_by_username,
                   admin.username as verified_by_username
            FROM matches m
            JOIN teams t1 ON m.team1_id = t1.id
            JOIN teams t2 ON m.team2_id = t2.id
            JOIN tournaments tour ON m.tournament_id = tour.id
            LEFT JOIN users u ON m.submitted_by_user_id = u.id
            LEFT JOIN users admin ON m.verified_by_admin_id = admin.id
            WHERE m.team1_id = ? OR m.team2_id = ?
            ORDER BY m.scheduled_time DESC
        `,
      [teamId, teamId],
      (error, rows) => {
        connection.end();
        if (error) {
          return callback(error, null);
        }
        callback(null, rows);
      }
    );
  }

  // Get pending matches for verification
  static getPendingVerification(callback) {
    const connection = createConnection();
    connection.query(
      `
            SELECT m.*, 
                   t1.name as team1_name, t2.name as team2_name,
                   tour.name as tournament_name,
                   u.username as submitted_by_username
            FROM matches m
            JOIN teams t1 ON m.team1_id = t1.id
            JOIN teams t2 ON m.team2_id = t2.id
            JOIN tournaments tour ON m.tournament_id = tour.id
            LEFT JOIN users u ON m.submitted_by_user_id = u.id
            WHERE m.status = 'completed' AND m.verified_by_admin_id IS NULL
            ORDER BY m.updated_at DESC
        `,
      (error, rows) => {
        connection.end();
        if (error) {
          return callback(error, null);
        }
        callback(null, rows);
      }
    );
  }

  // Get match statistics
  static getStats(tournamentId = null, callback) {
    let query = `
            SELECT 
                COUNT(*) as total_matches,
                COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_matches,
                COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_matches,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_matches,
                COUNT(CASE WHEN status = 'disputed' THEN 1 END) as disputed_matches
            FROM matches
        `;

    let params = [];
    if (tournamentId) {
      query += " WHERE tournament_id = ?";
      params.push(tournamentId);
    }

    const connection = createConnection();
    connection.query(query, params, (error, stats) => {
      connection.end();
      if (error) {
        return callback(error, null);
      }
      callback(null, stats[0]);
    });
  }
}

module.exports = Match;
