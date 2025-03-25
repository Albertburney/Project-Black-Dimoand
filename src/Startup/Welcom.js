const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Try to load the Setup module
let Setup;
try {
    Setup = require('./Setup');
} catch (error) {
    console.error('[WELCOME] Error loading Setup module:', error);
}

// Initialize module
function init() {
    console.log('[WELCOME] Welcome message system loaded');
    return true;
}

/**
 * Get the configured welcome channel for a guild
 * @param {Guild} guild - Discord.js Guild object
 * @returns {Promise<TextChannel|null>} The configured welcome channel or null
 */
async function getWelcomeChannel(guild) {
    try {
        if (!Setup || !Setup.loadServerConfig) {
            console.error('[WELCOME] Setup module not available');
            return null;
        }

        const config = Setup.loadServerConfig(guild.id);
        if (!config || !config.channels || !config.channels.welcome_channel) {
            return null;
        }

        const channelId = config.channels.welcome_channel.id;
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        
        if (!channel || !channel.isTextBased()) {
            return null;
        }
        
        return channel;
    } catch (error) {
        console.error('[WELCOME] Error getting welcome channel:', error);
        return null;
    }
}

/**
 * Get the welcome message template for a guild
 * @param {string} guildId - Discord guild ID
 * @returns {Object|null} The welcome message configuration or null
 */
function getWelcomeTemplate(guildId) {
    try {
        if (!Setup || !Setup.loadServerConfig) {
            console.error('[WELCOME] Setup module not available');
            return null;
        }

        const config = Setup.loadServerConfig(guildId);
        if (!config) {
            console.log(`[WELCOME] No server config found for guild ID ${guildId}`);
            return null;
        }
        
        // If welcome settings don't exist or aren't enabled, initialize them
        if (!config.welcome || config.welcome.enabled === false) {
            // Auto-create a default welcome template if a channel exists but no template
            if (config.channels && config.channels.welcome_channel) {
                config.welcome = {
                    enabled: true,
                    mentionUser: true,
                    showMemberCount: true,
                    color: 0x3498DB,
                    title: 'Welcome to {server}!',
                    message: 'Hi {mention}, welcome to **{server}**! You are our {membercount}th member!',
                    footer: 'Joined {server}'
                };
                
                // Save the updated config with default welcome template
                Setup.saveServerConfig(guildId, config);
                console.log(`[WELCOME] Created default welcome template for guild ID ${guildId}`);
                return config.welcome;
            }
            return null;
        }
        
        return config.welcome;
    } catch (error) {
        console.error('[WELCOME] Error getting welcome template:', error);
        return null;
    }
}

/**
 * Send a welcome message for a new guild member
 * @param {GuildMember} member - The Discord.js GuildMember who joined
 */
async function sendWelcomeMessage(member) {
    try {
        const { guild, user } = member;
        
        // Get welcome channel
        const welcomeChannel = await getWelcomeChannel(guild);
        if (!welcomeChannel) {
            console.log(`[WELCOME] No welcome channel configured for guild ${guild.id} (${guild.name})`);
            return;
        }
        
        // Get welcome template
        const template = getWelcomeTemplate(guild.id);
        if (!template) {
            console.log(`[WELCOME] No welcome template configured for guild ${guild.id} (${guild.name})`);
            return;
        }
        
        // Parse template variables
        const content = parseTemplateString(template.message || 'Welcome to the server, {user}!', member);
        
        // Create the embed
        const embed = new EmbedBuilder()
            .setColor(template.color || 0x3498DB)
            .setTitle(parseTemplateString(template.title || 'Welcome to {server}!', member))
            .setDescription(content)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTimestamp();
            
        // Add member count if configured
        if (template.showMemberCount) {
            embed.addFields({ 
                name: 'Member Count', 
                value: `You are the ${guild.memberCount}${getNumberSuffix(guild.memberCount)} member!` 
            });
        }
        
        // Add server icon if configured
        if (template.showServerIcon && guild.iconURL()) {
            embed.setImage(guild.iconURL({ dynamic: true, size: 256 }));
        }
        
        // Add footer if configured
        if (template.footer) {
            embed.setFooter({ 
                text: parseTemplateString(template.footer, member),
                iconURL: guild.iconURL({ dynamic: true })
            });
        }
        
        // Send the welcome message
        await welcomeChannel.send({ 
            content: template.mentionUser ? `<@${user.id}>` : null,
            embeds: [embed] 
        });
        
        console.log(`[WELCOME] Sent welcome message for ${user.tag} in ${guild.name}`);
        
        // Try to log the event using the Logging module
        try {
            const Logging = require('../Security/Logging');
            if (Logging && typeof Logging.logToChannel === 'function') {
                const logEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Welcome Message Sent')
                    .addFields(
                        { name: 'User', value: `${user.tag} (${user.id})` },
                        { name: 'Channel', value: `<#${welcomeChannel.id}>` },
                        { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>` }
                    )
                    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();
                
                await Logging.logToChannel(guild, logEmbed);
            }
        } catch (error) {
            console.error('[WELCOME] Error logging welcome message:', error);
        }
    } catch (error) {
        console.error('[WELCOME] Error sending welcome message:', error);
    }
}

/**
 * Parse template strings and replace placeholders with actual values
 * @param {string} template - The template string with placeholders
 * @param {GuildMember} member - The Discord.js GuildMember object
 * @returns {string} The parsed string with replaced placeholders
 */
function parseTemplateString(template, member) {
    const { guild, user } = member;
    
    // Replace common placeholders
    return template
        .replace(/{user}/g, user.username)
        .replace(/{usertag}/g, user.tag)
        .replace(/{userid}/g, user.id)
        .replace(/{server}/g, guild.name)
        .replace(/{serverid}/g, guild.id)
        .replace(/{membercount}/g, guild.memberCount)
        .replace(/{mention}/g, `<@${user.id}>`);
}

/**
 * Get the suffix for a number (1st, 2nd, 3rd, etc.)
 * @param {number} n - The number
 * @returns {string} The suffix
 */
function getNumberSuffix(n) {
    if (n >= 11 && n <= 13) return 'th';
    
    switch (n % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

// Initialize on module load
init();

module.exports = {
    sendWelcomeMessage,
    getWelcomeChannel,
    getWelcomeTemplate
};
