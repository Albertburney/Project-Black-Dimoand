/**
 * Logging middleware for the Black Diamond dashboard
 */

const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../../logs/dashboard');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Log requests to console and file
const logRequest = (req, res, next) => {
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const ip = req.ip || req.connection.remoteAddress;
    const method = req.method;
    const url = req.originalUrl || req.url;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const userId = req.user ? req.user.id : 'Unauthenticated';
    
    // Format log entry
    const logEntry = `[${timestamp}] ${ip} - ${method} ${url} - User: ${userId} - ${userAgent}`;
    
    // Log to console
    console.log(logEntry);
    
    // Log to file
    const logFile = path.join(logsDir, `${format(new Date(), 'yyyy-MM-dd')}.log`);
    fs.appendFile(logFile, logEntry + '\n', (err) => {
        if (err) {
            console.error('Error writing to log file:', err);
        }
    });
    
    // Continue to next middleware
    next();
};

// Log API calls with body data
const logApiRequest = (req, res, next) => {
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const ip = req.ip || req.connection.remoteAddress;
    const method = req.method;
    const url = req.originalUrl || req.url;
    const userId = req.user ? req.user.id : 'Unauthenticated';
    
    // Format log entry with body data for POST/PUT requests
    let logEntry = `[${timestamp}] API CALL - ${ip} - ${method} ${url} - User: ${userId}`;
    
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
        logEntry += ` - Body: ${JSON.stringify(req.body)}`;
    }
    
    // Log to console
    console.log(logEntry);
    
    // Log to API log file
    const logFile = path.join(logsDir, `api-${format(new Date(), 'yyyy-MM-dd')}.log`);
    fs.appendFile(logFile, logEntry + '\n', (err) => {
        if (err) {
            console.error('Error writing to API log file:', err);
        }
    });
    
    // Continue to next middleware
    next();
};

// Log errors
const logError = (err, req, res, next) => {
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const ip = req.ip || req.connection.remoteAddress;
    const method = req.method;
    const url = req.originalUrl || req.url;
    const userId = req.user ? req.user.id : 'Unauthenticated';
    
    // Format error log entry
    const logEntry = `[${timestamp}] ERROR - ${ip} - ${method} ${url} - User: ${userId} - ${err.stack}`;
    
    // Log to console
    console.error(logEntry);
    
    // Log to error log file
    const logFile = path.join(logsDir, `error-${format(new Date(), 'yyyy-MM-dd')}.log`);
    fs.appendFile(logFile, logEntry + '\n', (err) => {
        if (err) {
            console.error('Error writing to error log file:', err);
        }
    });
    
    // Continue to error handler
    next(err);
};

module.exports = {
    logRequest,
    logApiRequest,
    logError
}; 