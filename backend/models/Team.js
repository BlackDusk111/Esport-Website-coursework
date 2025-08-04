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

class Team {
  // Get all teams with pagination and filters
  static getAll(options = {}, callback) {
    const {
      page = 1,
      limit = 20,
      search = "",
      captainId = null,
      isActive = null,
    } = options;

    const offset = (page - 1) * limit;
    let query = `
            SELECT t.*, u.username as captain_username,
                   COUNT(tm.user_id) as member_count
            FROM teams t
            JOIN users u ON t.captain_id = u.id
            LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.status = 'active'
            WHERE 1=1
        `;

    let countQuery = "SELECT COUNT(*) as total FROM teams t WHERE 1=1";
    let queryParams = [];

    if (search) {
      query += " AND t.name LIKE ?";
      countQuery += " AND t.name LIKE ?";
      queryParams.push(`%${search}%`);
    }

    if (captainId) {
      query += " AND t.captain_id = ?";
      countQuery += " AND t.captain_id = ?";
      queryParams.push(captainId);
    }

    if (isActive !== null) {
      query += " AND t.is_active = ?";
      countQuery += " AND t.is_active = ?";
      queryParams.push(isActive);
    }

    query += " GROUP BY t.id ORDER BY t.created_at DESC LIMIT ? OFFSET ?";
    queryParams.push(limit, offset);

    const connection = createConnection();
    connection.query(query, queryParams, (error, teams) => {
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
          teams,
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

  // Get team by ID
  static getById(id, callback) {
    const connection = createConnection();
    connection.query(
      `
            SELECT t.*, u.username as captain_username,
                   COUNT(tm.user_id) as member_count
            FROM teams t
            JOIN users u ON t.captain_id = u.id
            LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.status = 'active'
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

  // Create new team
  static create(teamData, userId, ipAddress = "127.0.0.1", callback) {
    const { name } = teamData;

    const connection = createConnection();

    // Check if team name already exists
    connection.query(
      "SELECT id FROM teams WHERE name = ?",
      [name],
      (error, existing) => {
        if (error) {
          connection.end();
          return callback(error, null);
        }

        if (existing.length > 0) {
          connection.end();
          return callback(new Error("Team name already exists"), null);
        }

        // Insert new team
        connection.query(
          `
                INSERT INTO teams (name, captain_id)
                VALUES (?, ?)
            `,
          [name, userId],
          (insertError, result) => {
            if (insertError) {
              connection.end();
              return callback(insertError, null);
            }

            const teamId = result.insertId;

            // Add captain as active member
            connection.query(
              `
                    INSERT INTO team_members (team_id, user_id, status)
                    VALUES (?, ?, 'active')
                `,
              [teamId, userId],
              (memberError) => {
                if (memberError) {
                  connection.end();
                  return callback(memberError, null);
                }

                // Log audit
                logAudit(
                  userId,
                  "CREATE",
                  "teams",
                  teamId,
                  null,
                  teamData,
                  ipAddress
                )
                  .then(() => {
                    connection.end();
                    callback(null, teamId);
                  })
                  .catch((auditError) => {
                    connection.end();
                    callback(auditError, null);
                  });
              }
            );
          }
        );
      }
    );
  }

  // Update team
  static update(id, updateData, userId, ipAddress = "127.0.0.1", callback) {
    // First get the old data
    this.getById(id, (getError, oldData) => {
      if (getError) {
        return callback(getError, null);
      }

      if (!oldData) {
        return callback(new Error("Team not found"), null);
      }

      // Check if user is captain or admin
      if (oldData.captain_id !== userId) {
        const connection = createConnection();
        connection.query(
          "SELECT role FROM users WHERE id = ?",
          [userId],
          (userError, user) => {
            if (userError) {
              connection.end();
              return callback(userError, null);
            }
            if (user[0].role !== "admin") {
              connection.end();
              return callback(
                new Error("Only team captain or admin can update team"),
                null
              );
            }
            continueUpdate();
          }
        );
      } else {
        continueUpdate();
      }

      function continueUpdate() {
        const allowedFields = ["name", "is_active"];
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
                    UPDATE teams SET ${updates.join(
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
              return callback(new Error("Team not found"), null);
            }

            // Log audit
            logAudit(
              userId,
              "UPDATE",
              "teams",
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
      }
    });
  }

  // Delete team (soft delete by setting is_active to false)
  static delete(id, userId, ipAddress = "127.0.0.1", callback) {
    // First get the old data
    this.getById(id, (getError, oldData) => {
      if (getError) {
        return callback(getError, null);
      }

      if (!oldData) {
        return callback(new Error("Team not found"), null);
      }

      // Check if user is captain or admin
      if (oldData.captain_id !== userId) {
        const connection = createConnection();
        connection.query(
          "SELECT role FROM users WHERE id = ?",
          [userId],
          (userError, user) => {
            if (userError) {
              connection.end();
              return callback(userError, null);
            }
            if (user[0].role !== "admin") {
              connection.end();
              return callback(
                new Error("Only team captain or admin can delete team"),
                null
              );
            }
            continueDelete();
          }
        );
      } else {
        continueDelete();
      }

      function continueDelete() {
        const connection = createConnection();
        connection.query(
          `
                    UPDATE teams SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
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
              return callback(new Error("Team not found"), null);
            }

            // Log audit
            logAudit(
              userId,
              "DELETE",
              "teams",
              id,
              oldData,
              { is_active: false },
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
      }
    });
  }

  // Get team members
  static getMembers(teamId, callback) {
    const connection = createConnection();
    connection.query(
      `
            SELECT tm.*, u.username, u.email, u.role
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            WHERE tm.team_id = ?
            ORDER BY tm.status, tm.joined_at
        `,
      [teamId],
      (error, rows) => {
        connection.end();
        if (error) {
          return callback(error, null);
        }
        callback(null, rows);
      }
    );
  }

  // Add member to team
  static addMember(
    teamId,
    userId,
    captainId,
    ipAddress = "127.0.0.1",
    callback
  ) {
    // Check if team exists and is active
    this.getById(teamId, (getError, team) => {
      if (getError) {
        return callback(getError, null);
      }

      if (!team || !team.is_active) {
        return callback(new Error("Team not found or inactive"), null);
      }

      // Check if user is already a member
      const connection = createConnection();
      connection.query(
        `
                SELECT id FROM team_members WHERE team_id = ? AND user_id = ?
            `,
        [teamId, userId],
        (checkError, existing) => {
          if (checkError) {
            connection.end();
            return callback(checkError, null);
          }

          if (existing.length > 0) {
            connection.end();
            return callback(
              new Error("User is already a member of this team"),
              null
            );
          }

          // Add member with pending status
          connection.query(
            `
                    INSERT INTO team_members (team_id, user_id, status)
                    VALUES (?, ?, 'pending')
                `,
            [teamId, userId],
            (insertError) => {
              if (insertError) {
                connection.end();
                return callback(insertError, null);
              }

              // Log audit
              logAudit(
                captainId,
                "ADD_MEMBER",
                "team_members",
                teamId,
                null,
                { user_id: userId },
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
        }
      );
    });
  }

  // Accept team member
  static acceptMember(
    teamId,
    memberId,
    captainId,
    ipAddress = "127.0.0.1",
    callback
  ) {
    // Check if user is captain
    this.getById(teamId, (error, team) => {
      if (error) {
        return callback(error, null);
      }

      if (!team || team.captain_id !== captainId) {
        return callback(
          new Error("Only team captain can accept members"),
          null
        );
      }

      const connection = createConnection();
      connection.query(
        `
                UPDATE team_members SET status = 'active', updated_at = CURRENT_TIMESTAMP
                WHERE team_id = ? AND user_id = ? AND status = 'pending'
            `,
        [teamId, memberId],
        (error, result) => {
          connection.end();
          if (error) {
            return callback(error, null);
          }

          if (result.affectedRows === 0) {
            return callback(
              new Error("Member not found or already accepted"),
              null
            );
          }

          // Log audit
          logAudit(
            captainId,
            "ACCEPT_MEMBER",
            "team_members",
            teamId,
            null,
            { user_id: memberId },
            ipAddress
          )
            .then(() => callback(null, true))
            .catch((auditError) => callback(null, true)); // Don't fail on audit error
        }
      );
    });
  }

  // Remove member from team
  static async removeMember(
    teamId,
    memberId,
    captainId,
    ipAddress = "127.0.0.1"
  ) {
    // Check if user is captain
    const team = await this.getById(teamId);
    if (!team || team.captain_id !== captainId) {
      throw new Error("Only team captain can remove members");
    }

    // Don't allow removing captain
    if (team.captain_id === memberId) {
      throw new Error("Cannot remove team captain");
    }

    const [result] = await promisePool.execute(
      `
            UPDATE team_members SET status = 'removed', updated_at = CURRENT_TIMESTAMP
            WHERE team_id = ? AND user_id = ?
        `,
      [teamId, memberId]
    );

    if (result.affectedRows === 0) {
      throw new Error("Member not found");
    }

    // Log audit
    await logAudit(
      captainId,
      "REMOVE_MEMBER",
      "team_members",
      teamId,
      null,
      { user_id: memberId },
      ipAddress
    );

    return true;
  }

  // Get teams by user
  static getByUser(userId, callback) {
    const connection = createConnection();
    connection.query(
      `
            SELECT t.*, tm.status as membership_status, u.username as captain_username
            FROM teams t
            JOIN team_members tm ON t.id = tm.team_id
            JOIN users u ON t.captain_id = u.id
            WHERE tm.user_id = ? AND t.is_active = TRUE
            ORDER BY tm.status, t.created_at DESC
        `,
      [userId],
      (error, rows) => {
        connection.end();
        if (error) {
          return callback(error, null);
        }
        callback(null, rows);
      }
    );
  }

  // Get teams by captain
  static getByCaptain(captainId, callback) {
    const connection = createConnection();
    connection.query(
      `
            SELECT t.*, COUNT(tm.user_id) as member_count
            FROM teams t
            LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.status = 'active'
            WHERE t.captain_id = ?
            GROUP BY t.id
            ORDER BY t.created_at DESC
        `,
      [captainId],
      (error, rows) => {
        connection.end();
        if (error) {
          return callback(error, null);
        }
        callback(null, rows);
      }
    );
  }

  // Get teams by tournament
  static getByTournament(tournamentId, callback) {
    const connection = createConnection();
    connection.query(
      `
            SELECT DISTINCT t.id, t.name, t.created_at
            FROM teams t
            JOIN matches m ON (t.id = m.team1_id OR t.id = m.team2_id)
            WHERE m.tournament_id = ?
            ORDER BY t.name ASC
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

  // Check if user can join team
  static canJoin(userId, teamId, callback) {
    // Check if user is already a member
    const connection = createConnection();
    connection.query(
      `
            SELECT id FROM team_members WHERE team_id = ? AND user_id = ?
        `,
      [teamId, userId],
      (checkError, existing) => {
        if (checkError) {
          connection.end();
          return callback(checkError, null);
        }

        if (existing.length > 0) {
          connection.end();
          return callback(null, false);
        }

        // Check if team is active
        this.getById(teamId, (getError, team) => {
          connection.end();
          if (getError) {
            return callback(getError, null);
          }
          callback(null, team && team.is_active);
        });
      }
    );
  }

  // Get team statistics
  static getStats(teamId, callback) {
    const connection = createConnection();
    connection.query(
      `
            SELECT 
                COUNT(DISTINCT m.id) as total_matches,
                COUNT(CASE WHEN (m.team1_id = ? AND m.score1 > m.score2) OR 
                               (m.team2_id = ? AND m.score2 > m.score1) THEN 1 END) as wins,
                COUNT(CASE WHEN (m.team1_id = ? AND m.score1 < m.score2) OR 
                               (m.team2_id = ? AND m.score2 < m.score1) THEN 1 END) as losses,
                COUNT(CASE WHEN (m.team1_id = ? AND m.score1 = m.score2) OR 
                               (m.team2_id = ? AND m.score2 = m.score1) THEN 1 END) as draws
            FROM matches m
            WHERE (m.team1_id = ? OR m.team2_id = ?) AND m.status = 'completed'
        `,
      [teamId, teamId, teamId, teamId, teamId, teamId, teamId, teamId],
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

module.exports = Team;
