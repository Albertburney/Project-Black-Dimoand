const { EmbedBuilder } = require('discord.js');
const securityHandler = require('./syshandling');

// URL regex pattern for detecting links
const URL_PATTERN = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

// Initialize module
function init() {
    console.log('[SECURITY] AntiLinks system loaded');
    return true;
}

/**
 * Process a message to check for links
 * @param {Message} message - Discord.js Message object
 * @param {Object} config - Anti-link configuration for the guild
 */
async function processMessage(message, config) {
    try {
        // Check if channel is whitelisted
        if (config.whitelistedChannels.includes(message.channel.id)) {
            return;
        }
        
        // Check if user has a whitelisted role
        const hasWhitelistedRole = message.member.roles.cache.some(role => 
            config.whitelistedRoles.includes(role.id)
        );
        
        if (hasWhitelistedRole || config.whitelistedUsers.includes(message.author.id)) {
            return;
        }
        
        // Check for URLs in message
        const containsLink = URL_PATTERN.test(message.content);
        
        if (containsLink) {
            // Delete the message
            await message.delete().catch(err => {
                console.error('[SECURITY] Error deleting message with link:', err);
            });
            
            // Send warning to user
            const warningEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('⚠️ Links Not Allowed')
                .setDescription('Your message was deleted because it contained a link. Links are not allowed in this server unless you have permission.')
                .setFooter({ text: 'This is an automated security action' })
                .setTimestamp();
                
            await message.author.send({ embeds: [warningEmbed] }).catch(() => {
                // If DM fails, send in channel
                message.channel.send({ 
                    content: `${message.author}, links are not allowed in this server.`,
                    ephemeral: true
                }).catch(err => console.error('[SECURITY] Error sending warning:', err));
            });
            
            // Log the event
            const logData = {
                user: {
                    id: message.author.id,
                    tag: message.author.tag
                },
                channel: {
                    id: message.channel.id,
                    name: message.channel.name
                },
                guild: {
                    id: message.guild.id,
                    name: message.guild.name
                },
                content: message.content,
                timestamp: new Date().toISOString()
            };
            
            securityHandler.logSecurityEvent('LINK_BLOCKED', logData);
            
            // Send log to configured channel if available
            if (config.logChannel) {
                try {
                    const logChannel = await message.guild.channels.fetch(config.logChannel);
                    if (logChannel && logChannel.isTextBased()) {
                        const logEmbed = new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setTitle('🔒 Security: Link Blocked')
                            .addFields(
                                { name: 'User', value: `${message.author.tag} (${message.author.id})` },
                                { name: 'Channel', value: `<#${message.channel.id}>` },
                                { name: 'Message Content', value: message.content.length > 1024 ? 
                                  message.content.substring(0, 1021) + '...' : message.content }
                            )
                            .setTimestamp();
                            
                        await logChannel.send({ embeds: [logEmbed] });
                    }
                } catch (err) {
                    console.error('[SECURITY] Error sending to log channel:', err);
                }
            }
            
            console.log(`[SECURITY] Blocked link from ${message.author.tag} in ${message.guild.name}`);
        }
    } catch (error) {
        console.error('[SECURITY] Error in anti-link system:', error);
    }
}

// Initialize on module load
init();

module.exports = {
    processMessage
};
