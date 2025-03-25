/**
 * API routes for the Black Diamond dashboard
 */

const express = require('express');
const router = express.Router();
const { logApiRequest } = require('../middleware/logging');
const { isAuthenticated, isOwner, hasGuildPermission } = require('../middleware/auth');

// Apply API logging middleware
router.use(logApiRequest);

// Require authentication for all API routes
router.use(isAuthenticated);

// Get current user info
router.get('/user', (req, res) => {
    res.json({
        id: req.user.id,
        username: req.user.username,
        discriminator: req.user.discriminator,
        avatar: req.user.avatar,
        guilds: req.user.guilds
    });
});

// Get user's servers where bot is present
router.get('/servers', (req, res) => {
    // This would need integration with the bot to check which servers have the bot
    // For now, we'll return mock data
    const mockServers = req.user.guilds
        .filter(guild => (guild.permissions & 0x20) === 0x20) // Has MANAGE_SERVER permission
        .map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            owner: guild.owner,
            botPresent: Math.random() > 0.3, // Simulated bot presence
            memberCount: Math.floor(Math.random() * 1000) + 50,
        }));
    
    res.json(mockServers);
});

// Get server settings
router.get('/servers/:guildId/settings', hasGuildPermission(0x20), (req, res) => {
    const { guildId } = req.params;
    
    // Mock server settings
    res.json({
        id: guildId,
        name: `Server ${guildId}`,
        prefix: '!',
        welcomeEnabled: true,
        welcomeChannel: '123456789012345678',
        welcomeMessage: 'Welcome {user} to {server}!',
        loggingEnabled: true,
        loggingChannel: '123456789012345678',
        automodEnabled: true,
        automodSettings: {
            antiSpam: true,
            antiInvite: true,
            antiLink: false
        }
    });
});

// Update server settings
router.post('/servers/:guildId/settings', hasGuildPermission(0x20), (req, res) => {
    const { guildId } = req.params;
    
    // In a real implementation, this would validate and update settings in the database
    console.log(`Updating settings for guild ${guildId}:`, req.body);
    
    res.json({
        success: true,
        message: 'Settings updated successfully'
    });
});

// Get server stats
router.get('/servers/:guildId/stats', hasGuildPermission(0x20), (req, res) => {
    const { guildId } = req.params;
    
    // Mock server stats
    res.json({
        members: {
            total: 1250,
            online: 420,
            bots: 15
        },
        messages: {
            today: 1867,
            week: 12450
        },
        commands: {
            today: 342,
            week: 2156
        },
        growth: {
            day: 12,
            week: 56,
            month: 213
        }
    });
});

// Get server logs
router.get('/servers/:guildId/logs', hasGuildPermission(0x20), (req, res) => {
    const { guildId } = req.params;
    const { type, limit = 50 } = req.query;
    
    // Generate mock logs based on type
    const mockLogs = [];
    const eventTypes = type ? [type] : ['moderation', 'message', 'member', 'voice', 'server'];
    
    for (let i = 0; i < limit; i++) {
        const randomType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const timestamp = new Date(Date.now() - Math.random() * 86400000 * 7);
        
        let log = {
            id: `log-${i}`,
            timestamp,
            type: randomType
        };
        
        switch (randomType) {
            case 'moderation':
                log.action = ['warn', 'mute', 'kick', 'ban'][Math.floor(Math.random() * 4)];
                log.moderator = { id: '123456789', name: 'Moderator' };
                log.target = { id: '987654321', name: 'User' };
                log.reason = 'Violation of server rules';
                break;
            case 'message':
                log.action = ['create', 'edit', 'delete'][Math.floor(Math.random() * 3)];
                log.user = { id: '123456789', name: 'User' };
                log.channel = { id: '456789123', name: 'general' };
                if (log.action !== 'delete') {
                    log.content = 'This is a message content example';
                }
                break;
            case 'member':
                log.action = ['join', 'leave', 'nickname', 'role'][Math.floor(Math.random() * 4)];
                log.user = { id: '123456789', name: 'User' };
                if (log.action === 'nickname') {
                    log.oldNickname = 'OldNick';
                    log.newNickname = 'NewNick';
                } else if (log.action === 'role') {
                    log.role = { id: '456123789', name: 'Role Name' };
                    log.added = Math.random() > 0.5;
                }
                break;
            case 'voice':
                log.action = ['join', 'leave', 'move', 'mute', 'deafen'][Math.floor(Math.random() * 5)];
                log.user = { id: '123456789', name: 'User' };
                log.channel = { id: '456789123', name: 'voice-chat' };
                if (log.action === 'move') {
                    log.oldChannel = { id: '456789123', name: 'voice-chat-1' };
                    log.newChannel = { id: '456789124', name: 'voice-chat-2' };
                }
                break;
            case 'server':
                log.action = ['update', 'emoji_create', 'channel_create', 'channel_delete'][Math.floor(Math.random() * 4)];
                log.user = { id: '123456789', name: 'Admin' };
                if (log.action.includes('channel')) {
                    log.channel = { id: '456789123', name: 'new-channel' };
                } else if (log.action === 'emoji_create') {
                    log.emoji = { id: '456789123', name: 'pepe' };
                }
                break;
        }
        
        mockLogs.push(log);
    }
    
    // Sort by timestamp (newest first)
    mockLogs.sort((a, b) => b.timestamp - a.timestamp);
    
    res.json(mockLogs);
});

// -- Admin-only routes --

// Admin routes require owner authentication
router.use('/admin', isOwner);

// Get bot stats
router.get('/admin/stats', (req, res) => {
    res.json({
        uptime: 1234567, // milliseconds
        memory: {
            used: 256, // MB
            total: 512, // MB
            percent: 50
        },
        cpu: {
            usage: 15, // percent
            cores: 4
        },
        guilds: 150,
        users: 45000,
        commands: {
            total: 12500,
            perHour: 520
        },
        shards: [
            { id: 0, status: 'ready', guilds: 75, ping: 120 },
            { id: 1, status: 'ready', guilds: 75, ping: 150 }
        ]
    });
});

// Get all bot logs
router.get('/admin/logs', (req, res) => {
    const { type, limit = 100 } = req.query;
    
    // Mock bot logs
    const mockLogs = [];
    const logTypes = type ? [type] : ['info', 'warn', 'error', 'debug'];
    
    for (let i = 0; i < limit; i++) {
        const randomType = logTypes[Math.floor(Math.random() * logTypes.length)];
        const timestamp = new Date(Date.now() - Math.random() * 86400000 * 3);
        
        mockLogs.push({
            id: `log-${i}`,
            timestamp,
            type: randomType,
            message: `This is a ${randomType} log message`,
            source: ['API', 'Discord', 'Command', 'Database'][Math.floor(Math.random() * 4)],
            shard: Math.floor(Math.random() * 2)
        });
    }
    
    // Sort by timestamp (newest first)
    mockLogs.sort((a, b) => b.timestamp - a.timestamp);
    
    res.json(mockLogs);
});

// Execute admin action
router.post('/admin/actions/:action', (req, res) => {
    const { action } = req.params;
    const validActions = ['restart', 'reload', 'clearCache', 'updateCommands'];
    
    if (!validActions.includes(action)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid action'
        });
    }
    
    // In a real implementation, this would trigger actual actions in the bot
    console.log(`Executing admin action: ${action}`);
    
    res.json({
        success: true,
        message: `Action ${action} executed successfully`
    });
});

module.exports = router; 