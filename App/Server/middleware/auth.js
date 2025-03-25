/**
 * Authentication middleware for the Black Diamond dashboard
 */

// Check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    
    res.redirect('/auth/discord');
};

// Check if user is the bot owner
const isOwner = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/auth/discord');
    }
    
    // Check if user ID matches the owner ID from environment variables
    const ownerId = process.env.OWNER_ID;
    if (req.user.id === ownerId) {
        return next();
    }
    
    // If not owner, redirect to regular dashboard
    res.status(403).sendFile(path.join(__dirname, '../../Ui/403.html'));
};

// Check if user has admin permissions in a server
const hasGuildPermission = (permission) => {
    return (req, res, next) => {
        if (!req.isAuthenticated()) {
            return res.redirect('/auth/discord');
        }
        
        const { guildId } = req.params;
        
        // Find the guild in user's guilds
        const guild = req.user.guilds.find(g => g.id === guildId);
        
        // Check if user is admin or has the required permission
        const isAdmin = guild && (guild.permissions & 0x8) === 0x8;
        const hasPermission = guild && (guild.permissions & permission) === permission;
        
        if (isAdmin || hasPermission) {
            return next();
        }
        
        res.status(403).sendFile(path.join(__dirname, '../../Ui/403.html'));
    };
};

module.exports = {
    isAuthenticated,
    isOwner,
    hasGuildPermission
}; 