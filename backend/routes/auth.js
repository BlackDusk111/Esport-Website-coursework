const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2");
const { authenticateToken } = require("../middleware/auth");
const router = express.Router();

function createConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "hackerXdata0005hackedX",
    database: process.env.DB_NAME || "esports_tournament",
    charset: "utf8mb4",
    timeout: 10000,
  });
}

router.get("/test", (req, res) => {
  console.log("=== TEST ROUTE HIT ===");
  res.json({ message: "Auth routes are working!" });
  console.log("=== TEST ROUTE COMPLETED ===");
});

// Create a test user with proper password hash
router.post("/create-test-user", async (req, res) => {
  console.log("=== CREATE TEST USER ROUTE ===");

  const mysql = require("mysql2");
  let connection;

  try {
    const testEmail = "test@example.com";
    const testPassword = "password123";
    const testUsername = "testuser";

    console.log("Hashing password...");
    const passwordHash = await bcrypt.hash(testPassword, 12);
    console.log("Password hash created, length:", passwordHash.length);
    console.log("Hash preview:", passwordHash.substring(0, 20) + "...");

    connection = mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "password",
      database: process.env.DB_NAME || "esports_tournament",
      charset: "utf8mb4",
    });

    // First, check if user exists
    connection.query(
      "SELECT id FROM users WHERE email = ?",
      [testEmail],
      (selectError, existing) => {
        if (selectError) {
          console.error("Error checking existing user:", selectError);
          connection.end();
          return res.status(500).json({ error: "Database error" });
        }

        if (existing.length > 0) {
          console.log("Test user already exists");
          connection.end();
          return res.json({
            message: "Test user already exists",
            email: testEmail,
          });
        }

        // Create new user
        console.log("Creating test user...");
        connection.query(
          "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
          [testUsername, testEmail, passwordHash, "player"],
          (insertError, result) => {
            connection.end();

            if (insertError) {
              console.error("Error creating user:", insertError);
              return res.status(500).json({ error: "Failed to create user" });
            }

            console.log("Test user created successfully, ID:", result.insertId);
            res.json({
              message: "Test user created successfully",
              userId: result.insertId,
              email: testEmail,
              password: testPassword,
              hashLength: passwordHash.length,
            });
          }
        );
      }
    );
  } catch (error) {
    console.error("Create test user error:", error);
    if (connection) connection.end();
    res.status(500).json({ error: "Creation failed" });
  }
});
router.get("/debug-users", async (req, res) => {
  console.log("=== DEBUG USERS ROUTE ===");

  const mysql = require("mysql2");
  let connection;

  try {
    connection = mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "password",
      database: process.env.DB_NAME || "esports_tournament",
      charset: "utf8mb4",
    });

    connection.query(
      "SELECT id, username, email, role, LENGTH(password_hash) as hash_length, LEFT(password_hash, 20) as hash_preview FROM users",
      (error, users) => {
        connection.end();

        if (error) {
          console.error("Error fetching users:", error);
          return res.status(500).json({ error: "Database error" });
        }

        console.log("Users in database:", users.length);
        users.forEach((user) => {
          console.log(
            `User: ${user.username}, Email: ${user.email}, Hash Length: ${user.hash_length}, Hash Preview: ${user.hash_preview}...`
          );
        });

        res.json({
          count: users.length,
          users: users.map((u) => ({
            id: u.id,
            username: u.username,
            email: u.email,
            role: u.role,
            hash_length: u.hash_length,
            hash_preview: u.hash_preview + "...",
          })),
        });
      }
    );
  } catch (error) {
    console.error("Debug users error:", error);
    if (connection) connection.end();
    res.status(500).json({ error: "Debug failed" });
  }
});
router.get("/db-status", async (req, res) => {
  console.log("=== DB STATUS CHECK ===");

  const mysql = require("mysql2");
  let connection;

  try {
    connection = mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "password",
      database: process.env.DB_NAME || "esports_tournament",
      charset: "utf8mb4",
    });

    // Check for locks
    connection.query("SHOW PROCESSLIST", (error, processes) => {
      if (error) {
        console.error("Error checking processes:", error);
        connection.end();
        return res.status(500).json({ error: "Database error" });
      }

      console.log("Active processes:", processes.length);

      // Check for table locks
      connection.query(
        "SHOW OPEN TABLES WHERE In_use > 0",
        (lockError, locks) => {
          if (lockError) {
            console.error("Error checking locks:", lockError);
            connection.end();
            return res.status(500).json({ error: "Lock check error" });
          }

          console.log("Table locks:", locks.length);
          connection.end();

          res.json({
            processes: processes.length,
            locks: locks.length,
            processDetails: processes.map((p) => ({
              id: p.Id,
              user: p.User,
              host: p.Host,
              db: p.db,
              command: p.Command,
              time: p.Time,
              state: p.State,
            })),
            lockDetails: locks,
          });
        }
      );
    });
  } catch (error) {
    console.error("DB status error:", error);
    if (connection) connection.end();
    res.status(500).json({ error: "Status check failed" });
  }
});

router.post("/login-manual", async (req, res) => {
  console.log("=== MANUAL LOGIN ROUTE STARTED ===");

  const mysql = require("mysql2");
  let connection;

  try {
    const { email, password } = req.body;
    console.log("Email:", email);

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    console.log("Creating manual connection...");

    // Create connection with callback style, then promisify manually
    connection = mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "password",
      database: process.env.DB_NAME || "esports_tournament",
      charset: "utf8mb4",
      timeout: 5000, // 5 second timeout
    });

    console.log("Manual connection created, executing query with callback...");

    // Use callback style to avoid promise issues
    connection.query(
      "SELECT id, username, email, password_hash, role FROM users WHERE email = ?",
      [email],
      async (error, results) => {
        console.log("Query callback executed");

        if (error) {
          console.error("Query error:", error);
          connection.end();
          return res.status(500).json({ error: "Database error" });
        }

        console.log("Query results:", results.length, "users found");

        if (results.length === 0) {
          console.log("No user found");
          connection.end();
          return res.status(401).json({ error: "Invalid credentials" });
        }

        const user = results[0];
        console.log("Found user:", user.username);

        try {
          console.log("Checking password...");
          const passwordValid = await bcrypt.compare(
            password,
            user.password_hash
          );
          console.log("Password valid:", passwordValid);

          if (!passwordValid) {
            connection.end();
            return res.status(401).json({ error: "Invalid credentials" });
          }

          const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || "fallback-secret",
            { expiresIn: "24h" }
          );

          console.log("Sending success response");
          connection.end();
          res.json({
            message: "Login successful",
            token,
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              role: user.role,
            },
          });
          console.log("=== MANUAL LOGIN COMPLETED ===");
        } catch (bcryptError) {
          console.error("Bcrypt error:", bcryptError);
          connection.end();
          res.status(500).json({ error: "Authentication error" });
        }
      }
    );
  } catch (error) {
    console.error("Manual login error:", error.message);
    if (connection) connection.end();
    res.status(500).json({ error: "Login failed" });
  }
});
router.post("/login-simple", (req, res) => {
  console.log("=== SIMPLE LOGIN ROUTE STARTED ===");

  const { email, password } = req.body;
  console.log("Email:", email);

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  console.log("Creating direct connection...");
  const connection = createConnection();

  console.log("Executing database query...");
  connection.query(
    "SELECT id, username, email, password_hash, role FROM users WHERE email = ?",
    [email],
    async (error, users) => {
      console.log("Query callback executed");

      if (error) {
        console.error("Query error:", error);
        connection.end();
        return res.status(500).json({ error: "Database error" });
      }

      console.log("Query done. Users found:", users.length);

      if (users.length === 0) {
        console.log("No user found");
        connection.end();
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const user = users[0];
      console.log("Found user:", user.username);

      try {
        console.log("Checking password...");
        const passwordValid = await bcrypt.compare(
          password,
          user.password_hash
        );
        console.log("Password valid:", passwordValid);

        if (!passwordValid) {
          connection.end();
          return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign(
          { userId: user.id, email: user.email, role: user.role },
          process.env.JWT_SECRET || "fallback-secret",
          { expiresIn: "24h" }
        );

        console.log("Sending success response");
        connection.end();
        res.json({
          message: "Login successful",
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
          },
          tokens: {
            access_token: token,
            refresh_token: token, // For now, using same token as refresh token
          },
        });
        console.log("=== SIMPLE LOGIN COMPLETED ===");
      } catch (bcryptError) {
        console.error("Bcrypt error:", bcryptError);
        connection.end();
        res.status(500).json({ error: "Authentication error" });
      }
    }
  );
});

// Simple login with direct connection (bypass pool)
router.post("/login-direct", async (req, res) => {
  console.log("=== DIRECT LOGIN ROUTE STARTED ===");
  console.log("Request body:", req.body);

  let connection;
  try {
    const { email, password } = req.body;
    console.log("Extracted credentials for:", email);

    // Basic validation
    if (!email || !password) {
      console.log("Validation failed: Missing email or password");
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    console.log("Creating direct database connection...");
    connection = await getDirectConnection();
    console.log("Direct connection created successfully");

    console.log("Executing user lookup query...");
    const [users] = await connection.execute(
      "SELECT id, username, email, password_hash, role FROM users WHERE email = ?",
      [email]
    );
    console.log("Query completed, found users:", users.length);

    if (users.length === 0) {
      console.log("User not found");
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    const user = users[0];
    console.log("User found:", {
      id: user.id,
      username: user.username,
      email: user.email,
    });

    console.log("Verifying password...");
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    console.log("Password valid:", passwordValid);

    if (!passwordValid) {
      console.log("Password verification failed");
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    console.log("Generating JWT token...");
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET || "fallback-secret-key",
      { expiresIn: "24h" }
    );
    console.log("Token generated successfully");

    console.log("Sending login response...");
    const response = {
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    };
    console.log("Response data:", { ...response, token: "hidden" });
    res.json(response);
    console.log("=== DIRECT LOGIN ROUTE COMPLETED ===");
  } catch (error) {
    console.error("=== DIRECT LOGIN ROUTE ERROR ===");
    console.error("Login error:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      error: "Login failed",
    });
    console.log("=== DIRECT LOGIN ROUTE ERROR RESPONSE SENT ===");
  } finally {
    if (connection) {
      console.log("Closing direct connection...");
      await connection.end();
      console.log("Direct connection closed");
    }
  }
});
router.get("/db-test", (req, res) => {
  console.log("=== DB TEST ROUTE HIT ===");

  console.log("Testing database connection...");
  const connection = createConnection();

  connection.query("SELECT 1 as test", (error, result) => {
    connection.end();

    if (error) {
      console.error("=== DB TEST ROUTE ERROR ===");
      console.error("Database test error:", error);
      return res.status(500).json({
        error: "Database connection failed",
        details: error.message,
      });
    }

    console.log("Database query result:", result);
    res.json({
      message: "Database connection is working!",
      result: result[0],
    });
    console.log("=== DB TEST ROUTE COMPLETED ===");
  });
});

// Register new user - with direct connection
router.post("/register", (req, res) => {
  console.log("=== REGISTER ROUTE STARTED ===");
  console.log("Request body:", req.body);

  const { username, email, password, role = "player" } = req.body;
  console.log("Extracted data:", { username, email, role });

  // Basic validation
  if (!username || !email || !password) {
    console.log("Validation failed: Missing required fields");
    return res.status(400).json({
      error: "Username, email, and password are required",
    });
  }

  console.log("Creating connection...");
  const connection = createConnection();

  console.log("Starting database check for existing users...");
  // Check if user already exists
  connection.query(
    "SELECT id FROM users WHERE email = ? OR username = ?",
    [email, username],
    async (error, existingUsers) => {
      if (error) {
        console.error("Database error:", error);
        connection.end();
        return res.status(500).json({ error: "Database error" });
      }

      console.log("Existing users check result:", existingUsers.length);

      if (existingUsers.length > 0) {
        console.log("User already exists");
        connection.end();
        return res.status(409).json({
          error: "User with this email or username already exists",
        });
      }

      try {
        console.log("Starting password hashing...");
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        console.log("Password hashed successfully");

        console.log("Creating user in database...");
        connection.query(
          "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
          [username, email, passwordHash, role],
          (insertError, result) => {
            if (insertError) {
              console.error("Insert error:", insertError);
              connection.end();
              return res.status(500).json({ error: "Failed to create user" });
            }

            console.log("User created with ID:", result.insertId);

            console.log("Fetching created user...");
            connection.query(
              "SELECT id, username, email, role, created_at FROM users WHERE id = ?",
              [result.insertId],
              (selectError, newUsers) => {
                connection.end();

                if (selectError) {
                  console.error("Select error:", selectError);
                  return res
                    .status(500)
                    .json({ error: "Failed to fetch user" });
                }

                const newUser = newUsers[0];
                console.log("Fetched user:", newUser);

                console.log("Sending response...");
                const response = {
                  message: "User registered successfully",
                  user: {
                    id: newUser.id,
                    username: newUser.username,
                    email: newUser.email,
                    role: newUser.role,
                    created_at: newUser.created_at,
                  },
                };
                console.log("Response data:", response);
                res.status(201).json(response);
                console.log("=== REGISTER ROUTE COMPLETED ===");
              }
            );
          }
        );
      } catch (hashError) {
        console.error("Hashing error:", hashError);
        connection.end();
        res.status(500).json({ error: "Password hashing failed" });
      }
    }
  );
});

// Login user with direct connection - no promises
router.post("/login", (req, res) => {
  console.log("=== LOGIN ROUTE STARTED ===");
  console.log("Request body:", req.body);

  const { email, password } = req.body;
  console.log("Extracted credentials for:", email);

  // Basic validation
  if (!email || !password) {
    console.log("Validation failed: Missing email or password");
    return res.status(400).json({
      error: "Email and password are required",
    });
  }

  console.log("Creating connection...");
  const connection = createConnection();

  console.log("Looking up user in database...");
  connection.query(
    "SELECT id, username, email, password_hash, role FROM users WHERE email = ?",
    [email],
    async (error, users) => {
      if (error) {
        console.error("Database error:", error);
        connection.end();
        return res.status(500).json({ error: "Database error" });
      }

      console.log("Database query completed successfully");
      console.log("Found users:", users.length);

      if (users.length === 0) {
        console.log("User not found");
        connection.end();
        return res.status(401).json({
          error: "Invalid credentials",
        });
      }

      const user = users[0];
      console.log("User found:", {
        id: user.id,
        username: user.username,
        email: user.email,
      });

      try {
        console.log("Verifying password...");
        const passwordValid = await bcrypt.compare(
          password,
          user.password_hash
        );
        console.log("Password valid:", passwordValid);

        if (!passwordValid) {
          console.log("Password verification failed");
          connection.end();
          return res.status(401).json({
            error: "Invalid credentials",
          });
        }

        console.log("Generating JWT token...");
        const token = jwt.sign(
          {
            userId: user.id,
            email: user.email,
            role: user.role,
          },
          process.env.JWT_SECRET || "fallback-secret-key",
          { expiresIn: "24h" }
        );
        console.log("Token generated successfully");

        console.log("Sending login response...");
        const response = {
          message: "Login successful",
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
          },
        };
        console.log("Response data:", { ...response, token: "hidden" });
        res.json(response);
        console.log("=== LOGIN ROUTE COMPLETED ===");
        connection.end();
      } catch (compareError) {
        console.error("Password comparison error:", compareError);
        connection.end();
        res.status(500).json({ error: "Authentication failed" });
      }
    }
  );
});

// Refresh token
router.post("/refresh", (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(401).json({
        error: "Refresh token required",
        code: "REFRESH_TOKEN_REQUIRED",
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(
      refresh_token,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );

    const connection = createConnection();

    // Get user
    connection.query(
      "SELECT id, username, email, role, account_locked FROM users WHERE id = ?",
      [decoded.userId],
      async (error, users) => {
        if (error) {
          console.error("Database error:", error);
          connection.end();
          return res.status(500).json({ error: "Database error" });
        }

        if (users.length === 0 || users[0].account_locked) {
          connection.end();
          return res.status(401).json({
            error: "Invalid refresh token",
            code: "INVALID_REFRESH_TOKEN",
          });
        }

        const user = users[0];

        // Generate new access token
        const tokenPayload = {
          userId: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        };

        const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
          expiresIn: process.env.JWT_EXPIRES_IN || "24h",
        });

        try {
          // Create new session
          const ipAddress = getClientIP(req);
          const userAgent = req.get("User-Agent") || "";
          await createSession(user.id, accessToken, ipAddress, userAgent);

          res.json({
            accessToken,
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              role: user.role,
            },
          });
          connection.end();
        } catch (sessionError) {
          console.error("Session creation error:", sessionError);
          connection.end();
          res.status(500).json({ error: "Failed to create session" });
        }
      }
    );
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(401).json({
      error: "Invalid refresh token",
      code: "INVALID_REFRESH_TOKEN",
    });
  }
});

// Logout user
router.post("/logout", authenticateToken, (req, res) => {
  const userId = req.user.id;
  const sessionId = req.sessionId;

  const connection = createConnection();

  // Remove current session
  connection.query(
    "DELETE FROM user_sessions WHERE id = ?",
    [sessionId],
    async (error) => {
      if (error) {
        console.error("Database error:", error);
        connection.end();
        return res.status(500).json({ error: "Logout failed" });
      }

      try {
        // Log logout
        await logAudit(
          userId,
          "LOGOUT",
          "users",
          userId,
          null,
          null,
          getClientIP(req)
        );

        res.json({
          message: "Logout successful",
        });
        connection.end();
      } catch (auditError) {
        console.error("Audit error:", auditError);
        connection.end();
        res.json({
          message: "Logout successful",
        });
      }
    }
  );
});

// Logout from all devices
router.post("/logout-all", authenticateToken, (req, res) => {
  const userId = req.user.id;

  const connection = createConnection();

  // Remove all sessions for user
  connection.query(
    "DELETE FROM user_sessions WHERE user_id = ?",
    [userId],
    async (error) => {
      if (error) {
        console.error("Database error:", error);
        connection.end();
        return res.status(500).json({ error: "Logout failed" });
      }

      try {
        // Log logout from all devices
        await logAudit(
          userId,
          "LOGOUT_ALL",
          "users",
          userId,
          null,
          null,
          getClientIP(req)
        );

        res.json({
          message: "Logged out from all devices",
        });
        connection.end();
      } catch (auditError) {
        console.error("Audit error:", auditError);
        connection.end();
        res.json({
          message: "Logged out from all devices",
        });
      }
    }
  );
});

// Get current user profile
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        email_verified: user.email_verified,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      error: "Failed to get profile",
      code: "PROFILE_ERROR",
    });
  }
});

module.exports = router;
