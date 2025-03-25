const fs = require('fs');
const path = require('path');

// Ensure warnings directory exists
const warningsDir = path.join(__dirname, '../../warnings');
if (!fs.existsSync(warningsDir)) {
    fs.mkdirSync(warningsDir, { recursive: true });
}

// Get warnings file path for a guild
function getWarningsFilePath(guildId) {
    return path.join(warningsDir, `${guildId}.json`);
}

// Get all warnings for a guild
function getGuildWarnings(guildId) {
    const filePath = getWarningsFilePath(guildId);
    
    if (fs.existsSync(filePath)) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
            console.error(`Error reading warnings for guild ${guildId}:`, error);
            return {};
        }
    }
    
    return {};
}

// Get warnings for a specific user in a guild
function getUserWarnings(guildId, userId) {
    const warnings = getGuildWarnings(guildId);
    return warnings[userId] || [];
}

// Add a warning to a user
function addWarning(guildId, userId, warnData) {
    const warnings = getGuildWarnings(guildId);
    
    if (!warnings[userId]) {
        warnings[userId] = [];
    }
    
    // Create a warning ID based on timestamp and random number
    const warnId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const warning = {
        id: warnId,
        ...warnData,
        timestamp: new Date().toISOString()
    };
    
    warnings[userId].push(warning);
    
    // Save warnings back to file
    fs.writeFileSync(getWarningsFilePath(guildId), JSON.stringify(warnings, null, 2));
    
    return {
        warning,
        count: warnings[userId].length
    };
}

// Remove a specific warning
function removeWarning(guildId, userId, warnId) {
    const warnings = getGuildWarnings(guildId);
    
    if (!warnings[userId] || warnings[userId].length === 0) {
        return { success: false, reason: 'No warnings found for this user' };
    }
    
    // If warnId is 'all', remove all warnings
    if (warnId.toLowerCase() === 'all') {
        const count = warnings[userId].length;
        warnings[userId] = [];
        fs.writeFileSync(getWarningsFilePath(guildId), JSON.stringify(warnings, null, 2));
        return { success: true, count, allRemoved: true };
    }
    
    // Find the warning by ID
    const initialLength = warnings[userId].length;
    warnings[userId] = warnings[userId].filter(warning => warning.id !== warnId);
    
    // If no warnings were removed, return false
    if (initialLength === warnings[userId].length) {
        return { success: false, reason: 'Warning ID not found' };
    }
    
    // Save warnings back to file
    fs.writeFileSync(getWarningsFilePath(guildId), JSON.stringify(warnings, null, 2));
    
    return { 
        success: true, 
        count: warnings[userId].length,
        removed: initialLength - warnings[userId].length
    };
}

// Check if user should be kicked (5+ warnings)
function shouldBeKicked(guildId, userId) {
    const warnings = getUserWarnings(guildId, userId);
    return warnings.length >= 5;
}

module.exports = {
    getUserWarnings,
    addWarning,
    removeWarning,
    shouldBeKicked
}; 