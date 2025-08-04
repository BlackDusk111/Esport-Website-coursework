const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function setupDatabase() {
    let connection;
    
    try {
        // Create connection without database
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            charset: 'utf8mb4'
        });

        console.log('Connected to MySQL server');

        // Create database if it doesn't exist
        await connection.execute(`CREATE DATABASE IF NOT EXISTS esports_tournament CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        console.log('Database created or already exists');

        // Use the database
        await connection.query('USE esports_tournament');

        // Read and execute schema
        const fs = require('fs');
        const path = require('path');
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf8');
            
            // Split by semicolon and execute each statement
            const statements = schema.split(';').filter(stmt => stmt.trim());
            
            for (const statement of statements) {
                if (statement.trim()) {
                    try {
                        await connection.query(statement);
                    } catch (error) {
                        if (!error.message.includes('already exists')) {
                            console.error('Error executing statement:', error.message);
                        }
                    }
                }
            }
            console.log('Schema executed successfully');
        } else {
            console.log('Schema file not found, creating basic tables...');
            await createBasicTables(connection);
        }

        // Insert sample data
        await insertSampleData(connection);
        
        console.log('Database setup completed successfully!');
        
    } catch (error) {
        console.error('Database setup failed:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

async function createBasicTables(connection) {
    // Create basic tables if schema doesn't exist
    const tables = [
        `CREATE TABLE IF NOT EXISTS users (
            id INT PRIMARY KEY AUTO_INCREMENT,
            username VARCHAR(50) NOT NULL UNIQUE,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('player', 'captain', 'admin') NOT NULL DEFAULT 'player',
            email_verified BOOLEAN NOT NULL DEFAULT FALSE,
            account_locked BOOLEAN NOT NULL DEFAULT FALSE,
            failed_login_count INT NOT NULL DEFAULT 0,
            last_login TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        
        `CREATE TABLE IF NOT EXISTS teams (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) NOT NULL UNIQUE,
            captain_id INT NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (captain_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
        )`,
        
        `CREATE TABLE IF NOT EXISTS tournaments (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(200) NOT NULL,
            game VARCHAR(100) NOT NULL,
            start_date TIMESTAMP NOT NULL,
            end_date TIMESTAMP NULL,
            status ENUM('draft', 'active', 'completed', 'cancelled') NOT NULL DEFAULT 'draft',
            max_teams INT NOT NULL DEFAULT 16,
            created_by INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
        )`,
        
        `CREATE TABLE IF NOT EXISTS matches (
            id INT PRIMARY KEY AUTO_INCREMENT,
            tournament_id INT NOT NULL,
            team1_id INT NOT NULL,
            team2_id INT NOT NULL,
            scheduled_time TIMESTAMP NOT NULL,
            score1 INT NULL DEFAULT 0,
            score2 INT NULL DEFAULT 0,
            status ENUM('scheduled', 'in_progress', 'completed', 'disputed') NOT NULL DEFAULT 'scheduled',
            submitted_by_user_id INT NULL,
            verified_by_admin_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE ON UPDATE CASCADE,
            FOREIGN KEY (team1_id) REFERENCES teams(id) ON DELETE RESTRICT ON UPDATE CASCADE,
            FOREIGN KEY (team2_id) REFERENCES teams(id) ON DELETE RESTRICT ON UPDATE CASCADE
        )`
    ];

    for (const table of tables) {
        await connection.execute(table);
    }
    
    console.log('Basic tables created');
}

async function insertSampleData(connection) {
    try {
        // Check if admin user already exists
        const [existingAdmin] = await connection.query('SELECT id FROM users WHERE username = ?', ['admin']);
        
        if (existingAdmin.length === 0) {
            // Create admin user
            const adminPassword = await bcrypt.hash('admin123', 10);
            await connection.query(`
                INSERT INTO users (username, email, password_hash, role, email_verified) 
                VALUES (?, ?, ?, ?, ?)
            `, ['admin', 'admin@esports.com', adminPassword, 'admin', true]);
            console.log('Admin user created');
        }

        // Check if sample teams exist
        const [existingTeams] = await connection.query('SELECT id FROM teams LIMIT 1');
        
        if (existingTeams.length === 0) {
            // Create sample teams
            const teams = [
                { name: 'Team Alpha', captain: 'admin' },
                { name: 'Team Beta', captain: 'admin' },
                { name: 'Team Gamma', captain: 'admin' }
            ];

            for (const team of teams) {
                const [user] = await connection.query('SELECT id FROM users WHERE username = ?', [team.captain]);
                if (user.length > 0) {
                    await connection.query(`
                        INSERT INTO teams (name, captain_id) VALUES (?, ?)
                    `, [team.name, user[0].id]);
                }
            }
            console.log('Sample teams created');
        }

        // Check if sample tournaments exist
        const [existingTournaments] = await connection.query('SELECT id FROM tournaments LIMIT 1');
        
        if (existingTournaments.length === 0) {
            // Create sample tournaments
            const tournaments = [
                {
                    name: 'Valorant Championship 2024',
                    game: 'Valorant',
                    start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
                    end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
                    status: 'active',
                    max_teams: 16,
                    created_by: 'admin'
                },
                {
                    name: 'CS:GO Pro League',
                    game: 'CS:GO',
                    start_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
                    end_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
                    status: 'active',
                    max_teams: 8,
                    created_by: 'admin'
                }
            ];

            for (const tournament of tournaments) {
                const [user] = await connection.query('SELECT id FROM users WHERE username = ?', [tournament.created_by]);
                if (user.length > 0) {
                    await connection.query(`
                        INSERT INTO tournaments (name, game, start_date, end_date, status, max_teams, created_by) 
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [tournament.name, tournament.game, tournament.start_date, tournament.end_date, tournament.status, tournament.max_teams, user[0].id]);
                }
            }
            console.log('Sample tournaments created');
        }

        console.log('Sample data inserted successfully');
        
    } catch (error) {
        console.error('Error inserting sample data:', error);
    }
}

// Run the setup
if (require.main === module) {
    setupDatabase()
        .then(() => {
            console.log('Database setup completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Database setup failed:', error);
            process.exit(1);
        });
}

module.exports = { setupDatabase }; 