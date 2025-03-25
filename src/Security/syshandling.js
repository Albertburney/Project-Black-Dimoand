const fs = require('fs');
const path = require('path');
const { PermissionFlagsBits } = require('discord.js');

// Load security system modules
const AntiLinks = require('./Antilinks');
const AntiRaid = require('./Antiraid');
const Verification = require('./Verfication');

// Security system configuration storage
const securityConfig = new Map();

/**
 * Initialize the security system for a guild
 * @param {string} guildId - The Discord guild ID
 * @returns {Object} Security system configuration for this guild
 */
function initGuildSecurity(guildId) {
    if (!securityConfig.has(guildId)) {
        // Default security configuration - enabled by default
        securityConfig.set(guildId, {
            antiLinks: {
                enabled: true,
                whitelistedChannels: [],
                whitelistedRoles: [],
                whitelistedUsers: [],
                logChannel: null
            },
            antiRaid: {
                enabled: true,
                joinThreshold: 5, // Number of joins
                timeThreshold: 10, // In seconds
                action: 'lockdown', // 'lockdown', 'kick', 'ban'
                logChannel: null
            }
        });
        console.log(`[SECURITY] Security systems initialized for guild ${guildId}`);
    }
    return securityConfig.get(guildId);
}

/**
 * Handle a message event for security checks
 * @param {Message} message - Discord.js Message object
 */
function handleMessage(message) {
    if (message.author.bot) return; // Ignore bot messages
    
    // Get or initialize security config for this guild
    const guildConfig = initGuildSecurity(message.guild.id);
    
    // Check if user has admin permissions to bypass anti-link
    const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
    
    // Process anti-link checks if enabled
    if (guildConfig.antiLinks.enabled && !isAdmin) {
        AntiLinks.processMessage(message, guildConfig.antiLinks);
    }
}

/**
 * Handle member join events for anti-raid
 * @param {GuildMember} member - Discord.js GuildMember object
 */
function handleMemberJoin(member) {
    const guildConfig = initGuildSecurity(member.guild.id);
    
    // Process anti-raid checks if enabled
    if (guildConfig.antiRaid.enabled) {
        AntiRaid.processMemberJoin(member, guildConfig.antiRaid);
    }
}

/**
 * Handle interaction events for verification systems
 * @param {Interaction} interaction - Discord.js Interaction object
 * @returns {Promise<boolean>} True if the interaction was handled
 */
async function handleInteraction(interaction) {
    // Check if this is a verification-related interaction
    if (
        (interaction.isButton() && 
            (interaction.customId === 'verify_button' || 
             interaction.customId === 'verify_captcha' || 
             interaction.customId.startsWith('captcha_modal_'))
        ) || 
        (interaction.isModalSubmit() && interaction.customId.startsWith('captcha_verify_'))
    ) {
        await Verification.handleInteraction(interaction);
        return true;
    }
    
    return false;
}

/**
 * Get verification system commands for registration
 * @returns {Array} Array of command objects
 */
function getVerificationCommands() {
    return Verification.getCommands();
}

/**
 * Execute verification commands
 * @param {Interaction} interaction - Command interaction
 * @returns {Promise<boolean>} True if the command was handled
 */
async function executeVerificationCommand(interaction) {
    const { commandName } = interaction;
    
    if (commandName === 'reactionrole' || commandName === 'captchaverify') {
        await Verification.executeCommand(interaction);
        return true;
    }
    
    return false;
}

/**
 * Log security events to file
 * @param {string} event - Event type
 * @param {Object} data - Event data
 */
function logSecurityEvent(event, data) {
    const logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const logFile = path.join(logsDir, 'security.log');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${event}: ${JSON.stringify(data)}\n`;
    
    fs.appendFile(logFile, logEntry, (err) => {
        if (err) console.error('[SECURITY ERROR] Failed to write to log file:', err);
    });
}

module.exports = {
    initGuildSecurity,
    handleMessage,
    handleMemberJoin,
    handleInteraction,
    getVerificationCommands,
    executeVerificationCommand,
    logSecurityEvent
};
