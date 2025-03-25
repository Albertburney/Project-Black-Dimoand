/**
 * Configuration for the Black Diamond Bot Dashboard
 */

module.exports = {
    // Server settings
    server: {
        port: process.env.DASHBOARD_PORT || 3000,
        host: process.env.DASHBOARD_HOST || 'localhost',
        sessionSecret: process.env.SESSION_SECRET || 'black-diamond-dashboard-secret',
        cookieMaxAge: 86400000, // 1 day in milliseconds
    },
    
    // Discord OAuth2 settings
    oauth: {
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackUrl: process.env.CALLBACK_URL || 'http://localhost:3000/auth/discord/callback',
        scopes: ['identify', 'guilds'],
        prompt: 'none'
    },
    
    // Bot settings
    bot: {
        ownerId: process.env.OWNER_ID,
        supportServer: process.env.SUPPORT_SERVER,
        inviteUrl: process.env.BOT_INVITE_URL
    },
    
    // Dashboard settings
    dashboard: {
        title: 'Black Diamond Dashboard',
        description: 'Control panel for the Black Diamond Discord bot',
        themeColor: '#7289DA',
        favicon: '/assets/images/favicon.ico',
        logo: '/assets/images/logo.png',
        footerText: '© 2023 Black Diamond',
        supportEmail: 'support@blackdiamond.bot'
    },
    
    // Feature flags
    features: {
        economy: true,
        music: true,
        logging: true,
        security: true,
        inviteTracking: true,
        welcomeGoodbye: true
    },
    
    // API rate limiting
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        message: 'Too many requests, please try again later.'
    },
    
    // Logging settings
    logging: {
        level: process.env.LOG_LEVEL || 'info', // debug, info, warn, error
        format: 'combined', // common, combined, dev, short, tiny
        directory: '../../../logs/dashboard',
        filePattern: 'YYYY-MM-DD',
        console: true,
        file: true,
        maxFiles: 14, // days
        maxSize: '10m' // 10 megabytes
    }
}; 