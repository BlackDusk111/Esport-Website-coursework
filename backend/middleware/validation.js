const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: errors.array().map(error => ({
                field: error.path,
                message: error.msg,
                value: error.value
            }))
        });
    }
    next();
};

// User validation rules
const validateUserRegistration = [
    body('username')
        .isLength({ min: 3, max: 50 })
        .withMessage('Username must be between 3 and 50 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
    
    body('email')
        .isEmail()
        .withMessage('Must be a valid email address')
        .normalizeEmail()
        .isLength({ max: 255 })
        .withMessage('Email must not exceed 255 characters'),
    
    body('password')
        .isLength({ min: 8, max: 128 })
        .withMessage('Password must be between 8 and 128 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
    
    body('role')
        .optional()
        .isIn(['player', 'captain', 'admin'])
        .withMessage('Role must be player, captain, or admin'),
    
    handleValidationErrors
];

const validateUserLogin = [
    body('email')
        .isEmail()
        .withMessage('Must be a valid email address')
        .normalizeEmail(),
    
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    
    handleValidationErrors
];

const validateUserUpdate = [
    body('username')
        .optional()
        .isLength({ min: 3, max: 50 })
        .withMessage('Username must be between 3 and 50 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
    
    body('email')
        .optional()
        .isEmail()
        .withMessage('Must be a valid email address')
        .normalizeEmail(),
    
    handleValidationErrors
];

// Team validation rules
const validateTeamCreation = [
    body('name')
        .isLength({ min: 2, max: 100 })
        .withMessage('Team name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z0-9\s_-]+$/)
        .withMessage('Team name can only contain letters, numbers, spaces, underscores, and hyphens'),
    
    handleValidationErrors
];

const validateTeamUpdate = [
    body('name')
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage('Team name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z0-9\s_-]+$/)
        .withMessage('Team name can only contain letters, numbers, spaces, underscores, and hyphens'),
    
    body('is_active')
        .optional()
        .isBoolean()
        .withMessage('is_active must be a boolean'),
    
    handleValidationErrors
];

// Tournament validation rules
const validateTournamentCreation = [
    body('name')
        .isLength({ min: 3, max: 200 })
        .withMessage('Tournament name must be between 3 and 200 characters'),
    
    body('game')
        .isLength({ min: 2, max: 100 })
        .withMessage('Game name must be between 2 and 100 characters'),
    
    body('start_date')
        .isISO8601()
        .withMessage('Start date must be a valid ISO 8601 date')
        .custom((value) => {
            const startDate = new Date(value);
            const now = new Date();
            if (startDate <= now) {
                throw new Error('Start date must be in the future');
            }
            return true;
        }),
    
    body('end_date')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid ISO 8601 date')
        .custom((value, { req }) => {
            if (value && req.body.start_date) {
                const startDate = new Date(req.body.start_date);
                const endDate = new Date(value);
                if (endDate <= startDate) {
                    throw new Error('End date must be after start date');
                }
            }
            return true;
        }),
    
    body('max_teams')
        .optional()
        .isInt({ min: 2, max: 256 })
        .withMessage('Max teams must be between 2 and 256'),
    
    body('status')
        .optional()
        .isIn(['draft', 'active', 'completed', 'cancelled'])
        .withMessage('Status must be draft, active, completed, or cancelled'),
    
    handleValidationErrors
];

// Match validation rules
const validateMatchCreation = [
    body('tournament_id')
        .isInt({ min: 1 })
        .withMessage('Tournament ID must be a positive integer'),
    
    body('team1_id')
        .isInt({ min: 1 })
        .withMessage('Team 1 ID must be a positive integer'),
    
    body('team2_id')
        .isInt({ min: 1 })
        .withMessage('Team 2 ID must be a positive integer')
        .custom((value, { req }) => {
            if (value === req.body.team1_id) {
                throw new Error('Team 1 and Team 2 must be different');
            }
            return true;
        }),
    
    body('scheduled_time')
        .isISO8601()
        .withMessage('Scheduled time must be a valid ISO 8601 date'),
    
    handleValidationErrors
];

const validateScoreSubmission = [
    body('score1')
        .isInt({ min: 0, max: 999 })
        .withMessage('Score 1 must be between 0 and 999'),
    
    body('score2')
        .isInt({ min: 0, max: 999 })
        .withMessage('Score 2 must be between 0 and 999'),
    
    handleValidationErrors
];

// Parameter validation rules
const validateIdParam = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('ID must be a positive integer'),
    
    handleValidationErrors
];

const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    
    query('sort')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Sort must be asc or desc'),
    
    handleValidationErrors
];

// Search validation
const validateSearch = [
    query('q')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Search query must be between 1 and 100 characters')
        .escape(), // Escape HTML characters
    
    handleValidationErrors
];

// File upload validation
const validateFileUpload = [
    body('file_type')
        .optional()
        .isIn(['jpg', 'jpeg', 'png', 'gif', 'pdf'])
        .withMessage('File type must be jpg, jpeg, png, gif, or pdf'),
    
    handleValidationErrors
];

// Custom sanitization middleware
const sanitizeInput = (req, res, next) => {
    // Remove any potential XSS attempts from string fields
    const sanitizeString = (str) => {
        if (typeof str !== 'string') return str;
        return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                  .replace(/javascript:/gi, '')
                  .replace(/on\w+\s*=/gi, '');
    };

    // Recursively sanitize object properties
    const sanitizeObject = (obj) => {
        if (obj === null || typeof obj !== 'object') return obj;
        
        if (Array.isArray(obj)) {
            return obj.map(sanitizeObject);
        }
        
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                sanitized[key] = sanitizeString(value);
            } else if (typeof value === 'object') {
                sanitized[key] = sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    };

    req.body = sanitizeObject(req.body);
    req.query = sanitizeObject(req.query);
    req.params = sanitizeObject(req.params);
    
    next();
};

module.exports = {
    handleValidationErrors,
    validateUserRegistration,
    validateUserLogin,
    validateUserUpdate,
    validateTeamCreation,
    validateTeamUpdate,
    validateTournamentCreation,
    validateMatchCreation,
    validateScoreSubmission,
    validateIdParam,
    validatePagination,
    validateSearch,
    validateFileUpload,
    sanitizeInput
};