const mysql = require('mysql2');
require('dotenv').config();

// Database configuration with security settings
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'hackerXdata0005hackedX',
    database: process.env.DB_NAME || 'esports_tournament',
    charset: 'utf8mb4',
    timezone: 'Z',
    
    // Connection pool settings
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    connectTimeout: parseInt(process.env.DB_TIMEOUT) || 60000,
    
    // Security settings
    ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
    } : false,
    
    // Additional security options
    multipleStatements: false, // Prevent SQL injection through multiple statements
    dateStrings: true, // Return dates as strings to avoid timezone issues
    supportBigNumbers: true,
    bigNumberStrings: true,
    
    // Connection flags for security
    flags: [
        'COMPRESS',
        'PROTOCOL_41',
        'TRANSACTIONS'
    ]
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Promisify for async/await support
const promisePool = pool.promise();

// Connection health check
const healthCheck = async () => {
    try {
        const [rows] = await promisePool.execute('SELECT 1 as health');
        return rows[0].health === 1;
    } catch (error) {
        console.error('Database health check failed:', error);
        return false;
    }
};

// Audit logging helper
const logAudit = async (userId, action, tableName, recordId, oldValues = null, newValues = null, ipAddress = '127.0.0.1') => {
    try {
        const query = `
            INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values, ip_address)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        await promisePool.execute(query, [
            userId,
            action,
            tableName,
            recordId,
            oldValues ? JSON.stringify(oldValues) : null,
            newValues ? JSON.stringify(newValues) : null,
            ipAddress
        ]);
    } catch (error) {
        console.error('Audit logging failed:', error);
        // Don't throw error to prevent breaking main operations
    }
};

// Secure query execution with parameter validation
const secureExecute = async (query, params = [], options = {}) => {
    try {
        // Validate parameters to prevent injection
        if (params && !Array.isArray(params)) {
            throw new Error('Parameters must be an array');
        }
        
        // Log query execution in development
        if (process.env.NODE_ENV === 'development') {
            console.log('Executing query:', query);
            console.log('Parameters:', params);
        }
        
        const [rows, fields] = await promisePool.execute(query, params);
        
        // Log audit if specified
        if (options.audit) {
            await logAudit(
                options.audit.userId,
                options.audit.action,
                options.audit.tableName,
                options.audit.recordId,
                options.audit.oldValues,
                options.audit.newValues,
                options.audit.ipAddress
            );
        }
        
        return [rows, fields];
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
};

// Transaction helper
const transaction = async (callback) => {
    const connection = await promisePool.getConnection();
    
    try {
        await connection.beginTransaction();
        const result = await callback(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

// Connection event handlers
pool.on('connection', (connection) => {
    console.log('New database connection established as id ' + connection.threadId);
});

pool.on('error', (err) => {
    console.error('Database pool error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('Database connection lost, attempting to reconnect...');
    }
});

pool.on('release', (connection) => {
    console.log('Connection %d released', connection.threadId);
});

// Graceful shutdown
const closePool = () => {
    return new Promise((resolve) => {
        pool.end(() => {
            console.log('Database pool closed');
            resolve();
        });
    });
};

// Export pool and utilities
module.exports = {
    pool,
    promisePool,
    healthCheck,
    logAudit,
    secureExecute,
    transaction,
    closePool,
    execute: promisePool.execute.bind(promisePool),
    
    // Legacy support for direct pool access
    getConnection: (callback) => pool.getConnection(callback),
    end: (callback) => pool.end(callback)
};