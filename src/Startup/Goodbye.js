const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Try to load the Setup module
let Setup;
try {
    Setup = require('./Setup');
} catch (error) {
    console.error('[GOODBYE] Error loading Setup module:', error);
}

// Initialize module
function init() {
    console.log('[GOODBYE] Goodbye message system loaded');
    return true;
}

/**
 * Get the configured goodbye channel for a guild
 * @param {Guild} guild - Discord.js Guild object
 * @returns {Promise<TextChannel|null>} The configured goodbye channel or null
 */
async function getGoodbyeChannel(guild) {
    try {
        if (!Setup || !Setup.loadServerConfig) {
            console.error('[GOODBYE] Setup module not available');
            return null;
        }

        const config = Setup.loadServerConfig(guild.id);
        if (!config || !config.channels || !config.channels.goodbye_channel) {
            return null;
        }

        const channelId = config.channels.goodbye_channel.id;
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        
        if (!channel || !channel.isTextBased()) {
            return null;
        }
        
        return channel;
    } catch (error) {
        console.error('[GOODBYE] Error getting goodbye channel:', error);
        return null;
    }
}

/**
 * Get the goodbye message template for a guild
 * @param {string} guildId - Discord guild ID
 * @returns {Object|null} The goodbye message configuration or null
 */
function getGoodbyeTemplate(guildId) {
    try {
        if (!Setup || !Setup.loadServerConfig) {
            console.error('[GOODBYE] Setup module not available');
            return null;
        }

        const config = Setup.loadServerConfig(guildId);
        if (!config) {
            console.log(`[GOODBYE] No server config found for guild ID ${guildId}`);
            return null;
        }
        
        // If goodbye settings don't exist or aren't enabled, initialize them
        if (!config.goodbye || config.goodbye.enabled === false) {
            // Auto-create a default goodbye template if a channel exists but no template
            if (config.channels && config.channels.goodbye_channel) {
                config.goodbye = {
                    enabled: true,
                    showMemberCount: true,
                    showJoinDate: true,
                    showRoles: true,
                    color: 0xE74C3C,
                    title: 'Goodbye, {user}!',
                    message: "We're sad to see you go, {user}. Thanks for being with us!",
                    footer: 'Left {server}'
                };
                
                // Save the updated config with default goodbye template
                Setup.saveServerConfig(guildId, config);
                console.log(`[GOODBYE] Created default goodbye template for guild ID ${guildId}`);
                return config.goodbye;
            }
            return null;
        }
        
        return config.goodbye;
    } catch (error) {
        console.error('[GOODBYE] Error getting goodbye template:', error);
        return null;
    }
}

/**
 * Send a goodbye message for a member who left
 * @param {GuildMember} member - The Discord.js GuildMember who left
 */
async function sendGoodbyeMessage(member) {
    try {
        const { guild, user } = member;
        
        // Get goodbye channel
        const goodbyeChannel = await getGoodbyeChannel(guild);
        if (!goodbyeChannel) {
            console.log(`[GOODBYE] No goodbye channel configured for guild ${guild.id} (${guild.name})`);
            return;
        }
        
        // Get goodbye template
        const template = getGoodbyeTemplate(guild.id);
        if (!template) {
            console.log(`[GOODBYE] No goodbye template configured for guild ${guild.id} (${guild.name})`);
            return;
        }
        
        // Gather additional member information before they're gone
        const memberInfo = {
            joinedAt: member.joinedAt ? Math.floor(member.joinedAt.getTime() / 1000) : null,
            roles: Array.from(member.roles.cache.values())
                .filter(r => r.id !== guild.id) // Filter out @everyone
                .map(r => r.name)
                .join(', ') || 'None',
            nickname: member.nickname || user.username
        };
        
        // Parse template variables
        const content = parseTemplateString(
            template.message || 'Goodbye, {user}!', 
            member, 
            memberInfo
        );
        
        // Create the embed
        const embed = new EmbedBuilder()
            .setColor(template.color || 0xE74C3C)
            .setTitle(parseTemplateString(template.title || 'Goodbye, {user}!', member, memberInfo))
            .setDescription(content)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTimestamp();
            
        // Add member count if configured
        if (template.showMemberCount) {
            embed.addFields({ 
                name: 'Member Count', 
                value: `We now have ${guild.memberCount} members.` 
            });
        }
        
        // Add joined date if available
        if (memberInfo.joinedAt && template.showJoinDate) {
            embed.addFields({ 
                name: 'Joined Server', 
                value: `<t:${memberInfo.joinedAt}:R>` 
            });
        }
        
        // Add roles if configured
        if (template.showRoles) {
            embed.addFields({ 
                name: 'Roles', 
                value: memberInfo.roles.length > 1024 ? 'Too many roles to display' : memberInfo.roles 
            });
        }
        
        // Add footer if configured
        if (template.footer) {
            embed.setFooter({ 
                text: parseTemplateString(template.footer, member, memberInfo),
                iconURL: guild.iconURL({ dynamic: true })
            });
        }
        
        // Send the goodbye message
        await goodbyeChannel.send({ embeds: [embed] });
        
        console.log(`[GOODBYE] Sent goodbye message for ${user.tag} in ${guild.name}`);
        
        // Try to log the event using the Logging module
        try {
            const Logging = require('../Security/Logging');
            if (Logging && typeof Logging.logToChannel === 'function') {
                const logEmbed = new EmbedBuilder()
                    .setColor(0xFF5555)
                    .setTitle('👋 Goodbye Message Sent')
                    .addFields(
                        { name: 'User', value: `${user.tag} (${user.id})` },
                        { name: 'Channel', value: `<#${goodbyeChannel.id}>` },
                        { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>` }
                    )
                    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();
                
                await Logging.logToChannel(guild, logEmbed);
            }
        } catch (error) {
            console.error('[GOODBYE] Error logging goodbye message:', error);
        }
    } catch (error) {
        console.error('[GOODBYE] Error sending goodbye message:', error);
    }
}

/**
 * Parse template strings and replace placeholders with actual values
 * @param {string} template - The template string with placeholders
 * @param {GuildMember} member - The Discord.js GuildMember object
 * @param {Object} memberInfo - Additional member information
 * @returns {string} The parsed string with replaced placeholders
 */
function parseTemplateString(template, member, memberInfo = {}) {
    const { guild, user } = member;
    
    // Replace common placeholders
    return template
        .replace(/{user}/g, user.username)
        .replace(/{usertag}/g, user.tag)
        .replace(/{userid}/g, user.id)
        .replace(/{server}/g, guild.name)
        .replace(/{serverid}/g, guild.id)
        .replace(/{membercount}/g, guild.memberCount)
        .replace(/{nickname}/g, memberInfo.nickname || user.username)
        .replace(/{joinedat}/g, memberInfo.joinedAt ? `<t:${memberInfo.joinedAt}:R>` : 'Unknown')
        .replace(/{roles}/g, memberInfo.roles || 'None');
}

// Initialize on module load
init();

module.exports = {
    sendGoodbyeMessage,
    getGoodbyeChannel,
    getGoodbyeTemplate
};
