const jwt = require("jsonwebtoken");
const mysql = require("mysql2");

// Helper function to create database connection
function createConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "hackerXdata0005hackedX",
    database: process.env.DB_NAME || "esports_tournament",
  });
}

// Verify JWT token middleware
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: "Access token required",
        code: "TOKEN_MISSING",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if session exists and is valid
    const connection = createConnection();
    connection.query(
      "SELECT * FROM user_sessions WHERE user_id = ? AND token_hash = ? AND expires_at > NOW()",
      [decoded.userId, token],
      (error, sessions) => {
        if (error) {
          connection.end();
          console.error("Session check error:", error);
          return res.status(500).json({
            error: "Authentication failed",
            code: "AUTH_ERROR",
          });
        }

        if (sessions.length === 0) {
          connection.end();
          return res.status(401).json({
            error: "Invalid or expired session",
            code: "SESSION_INVALID",
          });
        }
        

        // Get user details
        connection.query(
          "SELECT id, username, email, role, account_locked, email_verified FROM users WHERE id = ?",
          [decoded.userId],
          (userError, users) => {
            connection.end();

            if (userError) {
              console.error("User check error:", userError);
              return res.status(500).json({
                error: "Authentication failed",
                code: "AUTH_ERROR",
              });
            }

            if (users.length === 0) {
              return res.status(401).json({
                error: "User not found",
                code: "USER_NOT_FOUND",
              });
            }

            const user = users[0];

            // Check if account is locked
            if (user.account_locked) {
              return res.status(403).json({
                error: "Account is locked",
                code: "ACCOUNT_LOCKED",
              });
            }

            // Check if email is verified for sensitive operations
            if (!user.email_verified && req.path.includes("/admin")) {
              return res.status(403).json({
                error: "Email verification required",
                code: "EMAIL_NOT_VERIFIED",
              });
            }

            // Add user info to request
            req.user = user;
            req.sessionId = sessions[0].id;

            next();
          }
        );
      }
    );
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Invalid token",
        code: "TOKEN_INVALID",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expired",
        code: "TOKEN_EXPIRED",
      });
    }

    console.error("Authentication error:", error);
    res.status(500).json({
      error: "Authentication failed",
      code: "AUTH_ERROR",
    });
  }
};

// Role-based authorization middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: "Insufficient permissions",
        code: "INSUFFICIENT_PERMISSIONS",
        required: allowedRoles,
        current: userRole,
      });
    }

    next();
  };
};

// Admin only middleware
const requireAdmin = requireRole("admin");

// Captain or Admin middleware
const requireCaptainOrAdmin = requireRole(["captain", "admin"]);

// Team ownership verification middleware
const requireTeamOwnership = (req, res, next) => {
  try {
    const teamId = req.params.teamId || req.params.id;
    const userId = req.user.id;

    // Admin can access any team
    if (req.user.role === "admin") {
      return next();
    }

    // Check if user is the team captain
    const connection = createConnection();
    connection.query(
      "SELECT captain_id FROM teams WHERE id = ?",
      [teamId],
      (error, teams) => {
        connection.end();

        if (error) {
          console.error("Team ownership verification error:", error);
          return res.status(500).json({
            error: "Authorization check failed",
            code: "AUTH_CHECK_ERROR",
          });
        }

        if (teams.length === 0) {
          return res.status(404).json({
            error: "Team not found",
            code: "TEAM_NOT_FOUND",
          });
        }

        if (teams[0].captain_id !== userId) {
          return res.status(403).json({
            error: "Team access denied",
            code: "TEAM_ACCESS_DENIED",
          });
        }

        next();
      }
    );
  } catch (error) {
    console.error("Team ownership verification error:", error);
    res.status(500).json({
      error: "Authorization check failed",
      code: "AUTH_CHECK_ERROR",
    });
  }
};

// Tournament ownership verification middleware
const requireTournamentOwnership = (req, res, next) => {
  try {
    const tournamentId = req.params.tournamentId || req.params.id;
    const userId = req.user.id;

    // Admin can access any tournament
    if (req.user.role === "admin") {
      return next();
    }

    // Check if user created the tournament
    const connection = createConnection();
    connection.query(
      "SELECT created_by FROM tournaments WHERE id = ?",
      [tournamentId],
      (error, tournaments) => {
        connection.end();

        if (error) {
          console.error("Tournament ownership verification error:", error);
          return res.status(500).json({
            error: "Authorization check failed",
            code: "AUTH_CHECK_ERROR",
          });
        }

        if (tournaments.length === 0) {
          return res.status(404).json({
            error: "Tournament not found",
            code: "TOURNAMENT_NOT_FOUND",
          });
        }

        if (tournaments[0].created_by !== userId) {
          return res.status(403).json({
            error: "Tournament access denied",
            code: "TOURNAMENT_ACCESS_DENIED",
          });
        }

        next();
      }
    );
  } catch (error) {
    console.error("Tournament ownership verification error:", error);
    res.status(500).json({
      error: "Authorization check failed",
      code: "AUTH_CHECK_ERROR",
    });
  }
};

// Optional authentication middleware (for public endpoints that can benefit from user context)
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return next(); // Continue without authentication
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user details
    const connection = createConnection();
    connection.query(
      "SELECT id, username, email, role, account_locked, email_verified FROM users WHERE id = ?",
      [decoded.userId],
      (error, users) => {
        connection.end();

        if (!error && users.length > 0 && !users[0].account_locked) {
          req.user = users[0];
        }

        next();
      }
    );
  } catch (error) {
    // Ignore authentication errors for optional auth
    next();
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireCaptainOrAdmin,
  requireTeamOwnership,
  requireTournamentOwnership,
  optionalAuth,
};
