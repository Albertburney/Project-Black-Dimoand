const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const fs = require('fs');
const path = require('path');
const Setup = require('../Startup/Setup');

// Initialize module
function init() {
    console.log('[LOGGING] Advanced logging system loaded');
    return true;
}

/**
 * Get the configured logging channel for a guild
 * @param {Guild} guild - Discord.js Guild object
 * @returns {Promise<TextChannel|null>} The configured logging channel or null
 */
async function getLoggingChannel(guild) {
    try {
        if (!Setup || !Setup.loadServerConfig) {
            console.error('[LOGGING] Setup module not available');
            return null;
        }

        const config = Setup.loadServerConfig(guild.id);
        if (!config || !config.channels || !config.channels.logs_channel) {
            return null;
        }

        const channelId = config.channels.logs_channel.id;
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        
        if (!channel || !channel.isTextBased()) {
            return null;
        }
        
        return channel;
    } catch (error) {
        console.error('[LOGGING] Error getting logging channel:', error);
        return null;
    }
}

/**
 * Log an event to the configured logging channel
 * @param {Guild} guild - Discord.js Guild object
 * @param {EmbedBuilder} embed - The embed to send
 */
async function logToChannel(guild, embed) {
    try {
        const loggingChannel = await getLoggingChannel(guild);
        if (!loggingChannel) return;
        
        await loggingChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('[LOGGING] Error logging to channel:', error);
    }
}

/**
 * Log an event to file
 * @param {string} event - Event type
 * @param {Object} data - Event data
 */
function logToFile(event, data) {
    try {
        const logsDir = path.join(__dirname, '../../logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        
        const logFile = path.join(logsDir, 'activity.log');
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${event}: ${JSON.stringify(data)}\n`;
        
        fs.appendFile(logFile, logEntry, (err) => {
            if (err) console.error('[LOGGING] Error writing to log file:', err);
        });
    } catch (error) {
        console.error('[LOGGING] Error logging to file:', error);
    }
}

// Message Delete Handler
async function handleMessageDelete(message) {
    if (!message.guild || message.author?.bot) return;
    
    try {
        // Create log data
        const logData = {
            user: {
                id: message.author?.id,
                tag: message.author?.tag
            },
            channel: {
                id: message.channel.id,
                name: message.channel.name
            },
            content: message.content,
            guild: {
                id: message.guild.id,
                name: message.guild.name
            },
            timestamp: new Date().toISOString()
        };
        
        // Log to file
        logToFile('MESSAGE_DELETE', logData);
        
        // Create embed
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🗑️ Message Deleted')
            .addFields(
                { name: 'Author', value: message.author ? `${message.author.tag} (${message.author.id})` : 'Unknown User' },
                { name: 'Channel', value: `<#${message.channel.id}>` }
            )
            .setTimestamp();
            
        // Add content if exists and not empty
        if (message.content && message.content.length > 0) {
            embed.addFields({ 
                name: 'Content', 
                value: message.content.length > 1024 ? message.content.substring(0, 1021) + '...' : message.content 
            });
        }
        
        // Add attachments if any
        if (message.attachments.size > 0) {
            const attachmentList = Array.from(message.attachments.values())
                .map(a => `[${a.name}](${a.url})`)
                .join('\n');
                
            embed.addFields({ name: 'Attachments', value: attachmentList.length > 1024 ? 'Multiple attachments were uploaded' : attachmentList });
        }
        
        // Log to channel
        await logToChannel(message.guild, embed);
    } catch (error) {
        console.error('[LOGGING] Error handling message delete:', error);
    }
}

// Message Update Handler
async function handleMessageUpdate(oldMessage, newMessage) {
    if (!newMessage.guild || newMessage.author?.bot || oldMessage.content === newMessage.content) return;
    
    try {
        // Create log data
        const logData = {
            user: {
                id: newMessage.author?.id,
                tag: newMessage.author?.tag
            },
            channel: {
                id: newMessage.channel.id,
                name: newMessage.channel.name
            },
            oldContent: oldMessage.content,
            newContent: newMessage.content,
            guild: {
                id: newMessage.guild.id,
                name: newMessage.guild.name
            },
            timestamp: new Date().toISOString()
        };
        
        // Log to file
        logToFile('MESSAGE_UPDATE', logData);
        
        // Create embed
        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('✏️ Message Edited')
            .addFields(
                { name: 'Author', value: newMessage.author ? `${newMessage.author.tag} (${newMessage.author.id})` : 'Unknown User' },
                { name: 'Channel', value: `<#${newMessage.channel.id}>` },
                { 
                    name: 'Before', 
                    value: oldMessage.content ? (oldMessage.content.length > 1024 ? oldMessage.content.substring(0, 1021) + '...' : oldMessage.content) : 'No content' 
                },
                { 
                    name: 'After', 
                    value: newMessage.content ? (newMessage.content.length > 1024 ? newMessage.content.substring(0, 1021) + '...' : newMessage.content) : 'No content' 
                }
            )
            .setTimestamp();
            
        // Add jump link
        embed.addFields({ name: 'Jump to Message', value: `[Click Here](${newMessage.url})` });
        
        // Log to channel
        await logToChannel(newMessage.guild, embed);
    } catch (error) {
        console.error('[LOGGING] Error handling message update:', error);
    }
}

// Channel Create Handler
async function handleChannelCreate(channel) {
    if (!channel.guild) return;
    
    try {
        // Create log data
        const logData = {
            channel: {
                id: channel.id,
                name: channel.name,
                type: channel.type
            },
            guild: {
                id: channel.guild.id,
                name: channel.guild.name
            },
            timestamp: new Date().toISOString()
        };
        
        // Log to file
        logToFile('CHANNEL_CREATE', logData);
        
        // Try to fetch audit logs to get who created the channel
        let creator = 'Unknown';
        try {
            const auditLogs = await channel.guild.fetchAuditLogs({
                type: AuditLogEvent.ChannelCreate,
                limit: 1
            });
            
            const log = auditLogs.entries.first();
            if (log && log.target.id === channel.id) {
                creator = `${log.executor.tag} (${log.executor.id})`;
            }
        } catch (err) {
            console.error('[LOGGING] Error fetching audit logs:', err);
        }
        
        // Create embed
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('📝 Channel Created')
            .addFields(
                { name: 'Channel', value: `${channel.name} (<#${channel.id}>)` },
                { name: 'Type', value: formatChannelType(channel.type) },
                { name: 'Created by', value: creator }
            )
            .setTimestamp();
            
        // Log to channel
        await logToChannel(channel.guild, embed);
    } catch (error) {
        console.error('[LOGGING] Error handling channel create:', error);
    }
}

// Channel Delete Handler
async function handleChannelDelete(channel) {
    if (!channel.guild) return;
    
    try {
        // Create log data
        const logData = {
            channel: {
                id: channel.id,
                name: channel.name,
                type: channel.type
            },
            guild: {
                id: channel.guild.id,
                name: channel.guild.name
            },
            timestamp: new Date().toISOString()
        };
        
        // Log to file
        logToFile('CHANNEL_DELETE', logData);
        
        // Try to fetch audit logs to get who deleted the channel
        let deleter = 'Unknown';
        try {
            const auditLogs = await channel.guild.fetchAuditLogs({
                type: AuditLogEvent.ChannelDelete,
                limit: 1
            });
            
            const log = auditLogs.entries.first();
            if (log && log.target.id === channel.id) {
                deleter = `${log.executor.tag} (${log.executor.id})`;
            }
        } catch (err) {
            console.error('[LOGGING] Error fetching audit logs:', err);
        }
        
        // Create embed
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🗑️ Channel Deleted')
            .addFields(
                { name: 'Channel', value: channel.name },
                { name: 'Type', value: formatChannelType(channel.type) },
                { name: 'Deleted by', value: deleter }
            )
            .setTimestamp();
            
        // Log to channel
        await logToChannel(channel.guild, embed);
    } catch (error) {
        console.error('[LOGGING] Error handling channel delete:', error);
    }
}

// Member Join Handler
async function handleMemberJoin(member) {
    try {
        // Account age check
        const accountCreated = member.user.createdAt;
        const now = new Date();
        const accountAge = (now - accountCreated) / (1000 * 60 * 60 * 24); // in days
        
        // Create log data
        const logData = {
            user: {
                id: member.user.id,
                tag: member.user.tag,
                accountAge: accountAge.toFixed(2)
            },
            guild: {
                id: member.guild.id,
                name: member.guild.name
            },
            timestamp: new Date().toISOString()
        };
        
        // Log to file
        logToFile('MEMBER_JOIN', logData);
        
        // Create embed
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('📥 Member Joined')
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: 'User', value: `${member.user.tag} (${member.user.id})` },
                { name: 'Account Created', value: `<t:${Math.floor(accountCreated.getTime() / 1000)}:R>` },
                { name: 'Account Age', value: `${accountAge.toFixed(2)} days` }
            )
            .setTimestamp();
            
        // Add warning if account is new
        if (accountAge < 7) {
            embed.addFields({ name: '⚠️ Warning', value: 'This account was created recently!' });
        }
        
        // Log to channel
        await logToChannel(member.guild, embed);
    } catch (error) {
        console.error('[LOGGING] Error handling member join:', error);
    }
}

// Member Leave Handler
async function handleMemberLeave(member) {
    try {
        // Create log data
        const logData = {
            user: {
                id: member.user.id,
                tag: member.user.tag
            },
            roles: Array.from(member.roles.cache.values()).map(r => r.name),
            joinedAt: member.joinedAt,
            guild: {
                id: member.guild.id,
                name: member.guild.name
            },
            timestamp: new Date().toISOString()
        };
        
        // Log to file
        logToFile('MEMBER_LEAVE', logData);
        
        // Try to fetch audit logs to determine if this was a kick
        let leaveReason = 'Left the server';
        let responsible = null;
        try {
            const auditLogs = await member.guild.fetchAuditLogs({
                type: AuditLogEvent.MemberKick,
                limit: 5
            });
            
            const kickLog = auditLogs.entries.find(
                log => log.target.id === member.user.id && 
                (Date.now() - log.createdTimestamp) < 5000
            );
            
            if (kickLog) {
                leaveReason = `Kicked | Reason: ${kickLog.reason || 'No reason provided'}`;
                responsible = kickLog.executor;
            }
        } catch (err) {
            console.error('[LOGGING] Error fetching audit logs:', err);
        }
        
        // Create embed
        const embed = new EmbedBuilder()
            .setColor(0xFF9900)
            .setTitle('📤 Member Left')
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: 'User', value: `${member.user.tag} (${member.user.id})` },
                { name: 'Reason', value: leaveReason }
            )
            .setTimestamp();
            
        // Add responsible user if kicked
        if (responsible) {
            embed.addFields({ name: 'Responsible Moderator', value: `${responsible.tag} (${responsible.id})` });
        }
        
        // Add join date if available
        if (member.joinedAt) {
            const joinedTime = Math.floor(member.joinedAt.getTime() / 1000);
            embed.addFields({ name: 'Joined Server', value: `<t:${joinedTime}:R>` });
        }
        
        // Add roles if any (except @everyone)
        const roles = member.roles.cache.filter(r => r.id !== member.guild.id);
        if (roles.size > 0) {
            const roleList = roles.map(r => r.name).join(', ');
            embed.addFields({ 
                name: 'Roles', 
                value: roleList.length > 1024 ? `${roles.size} roles` : roleList 
            });
        }
        
        // Log to channel
        await logToChannel(member.guild, embed);
    } catch (error) {
        console.error('[LOGGING] Error handling member leave:', error);
    }
}

// Member Update Handler
async function handleMemberUpdate(oldMember, newMember) {
    try {
        // Skip bot updates
        if (newMember.user.bot) return;
        
        // Check for role changes
        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
        
        // Check for nickname changes
        const oldNick = oldMember.nickname || oldMember.user.username;
        const newNick = newMember.nickname || newMember.user.username;
        const nicknameChanged = oldNick !== newNick;
        
        // If nothing changed that we track, return
        if (addedRoles.size === 0 && removedRoles.size === 0 && !nicknameChanged) {
            return;
        }
        
        // Create log data
        const logData = {
            user: {
                id: newMember.user.id,
                tag: newMember.user.tag
            },
            changes: {
                nickname: nicknameChanged ? { old: oldNick, new: newNick } : null,
                addedRoles: addedRoles.map(r => ({ id: r.id, name: r.name })),
                removedRoles: removedRoles.map(r => ({ id: r.id, name: r.name }))
            },
            guild: {
                id: newMember.guild.id,
                name: newMember.guild.name
            },
            timestamp: new Date().toISOString()
        };
        
        // Log to file
        logToFile('MEMBER_UPDATE', logData);
        
        // Log role changes
        if (addedRoles.size > 0 || removedRoles.size > 0) {
            // Try to fetch audit logs to get who changed the roles
            let changer = 'Unknown';
            try {
                const auditLogs = await newMember.guild.fetchAuditLogs({
                    type: AuditLogEvent.MemberRoleUpdate,
                    limit: 5
                });
                
                const log = auditLogs.entries.find(
                    entry => entry.target.id === newMember.user.id && 
                    (Date.now() - entry.createdTimestamp) < 5000
                );
                
                if (log) {
                    changer = `${log.executor.tag} (${log.executor.id})`;
                }
            } catch (err) {
                console.error('[LOGGING] Error fetching audit logs:', err);
            }
            
            // Create role change embed
            if (addedRoles.size > 0 || removedRoles.size > 0) {
                const roleEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('👥 Member Roles Updated')
                    .addFields(
                        { name: 'Member', value: `${newMember.user.tag} (${newMember.user.id})` },
                        { name: 'Updated by', value: changer }
                    )
                    .setThumbnail(newMember.user.displayAvatarURL())
                    .setTimestamp();
                    
                if (addedRoles.size > 0) {
                    roleEmbed.addFields({ 
                        name: '➕ Added Roles', 
                        value: addedRoles.map(r => r.name).join(', ') 
                    });
                }
                
                if (removedRoles.size > 0) {
                    roleEmbed.addFields({ 
                        name: '➖ Removed Roles', 
                        value: removedRoles.map(r => r.name).join(', ') 
                    });
                }
                
                // Log to channel
                await logToChannel(newMember.guild, roleEmbed);
            }
        }
        
        // Log nickname changes
        if (nicknameChanged) {
            // Try to fetch audit logs
            let changer = 'Unknown (possibly self-change)';
            try {
                const auditLogs = await newMember.guild.fetchAuditLogs({
                    type: AuditLogEvent.MemberUpdate,
                    limit: 5
                });
                
                const log = auditLogs.entries.find(
                    entry => entry.target.id === newMember.user.id && 
                    (Date.now() - entry.createdTimestamp) < 5000 &&
                    entry.changes.some(change => change.key === 'nick')
                );
                
                if (log) {
                    changer = `${log.executor.tag} (${log.executor.id})`;
                }
            } catch (err) {
                console.error('[LOGGING] Error fetching audit logs:', err);
            }
            
            // Create nickname change embed
            const nickEmbed = new EmbedBuilder()
                .setColor(0x00AAFF)
                .setTitle('📝 Nickname Changed')
                .addFields(
                    { name: 'Member', value: `${newMember.user.tag} (${newMember.user.id})` },
                    { name: 'Old Nickname', value: oldNick },
                    { name: 'New Nickname', value: newNick },
                    { name: 'Changed by', value: changer }
                )
                .setThumbnail(newMember.user.displayAvatarURL())
                .setTimestamp();
                
            // Log to channel
            await logToChannel(newMember.guild, nickEmbed);
        }
    } catch (error) {
        console.error('[LOGGING] Error handling member update:', error);
    }
}

// Voice State Update Handler
async function handleVoiceStateUpdate(oldState, newState) {
    try {
        // Skip bot updates
        if (oldState.member.user.bot) return;
        
        // Get the member and guild
        const member = newState.member;
        const guild = newState.guild;
        
        // Check what changed
        const joined = !oldState.channelId && newState.channelId;
        const left = oldState.channelId && !newState.channelId;
        const moved = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;
        
        // If nothing we care about changed, return
        if (!joined && !left && !moved) return;
        
        // Create log data
        const logData = {
            user: {
                id: member.user.id,
                tag: member.user.tag
            },
            change: {
                type: joined ? 'join' : (left ? 'leave' : 'move'),
                oldChannel: oldState.channelId ? { 
                    id: oldState.channelId, 
                    name: oldState.channel?.name || 'Unknown' 
                } : null,
                newChannel: newState.channelId ? { 
                    id: newState.channelId, 
                    name: newState.channel?.name || 'Unknown' 
                } : null
            },
            guild: {
                id: guild.id,
                name: guild.name
            },
            timestamp: new Date().toISOString()
        };
        
        // Log to file
        logToFile('VOICE_UPDATE', logData);
        
        // Create embed based on what happened
        let embed;
        
        if (joined) {
            embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🎙️ Member Joined Voice Channel')
                .addFields(
                    { name: 'Member', value: `${member.user.tag} (${member.user.id})` },
                    { name: 'Channel', value: `${newState.channel.name} (<#${newState.channelId}>)` }
                )
                .setTimestamp();
        } else if (left) {
            embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🎙️ Member Left Voice Channel')
                .addFields(
                    { name: 'Member', value: `${member.user.tag} (${member.user.id})` },
                    { name: 'Channel', value: `${oldState.channel.name} (<#${oldState.channelId}>)` }
                )
                .setTimestamp();
        } else if (moved) {
            embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('🎙️ Member Moved Voice Channels')
                .addFields(
                    { name: 'Member', value: `${member.user.tag} (${member.user.id})` },
                    { name: 'From', value: `${oldState.channel.name} (<#${oldState.channelId}>)` },
                    { name: 'To', value: `${newState.channel.name} (<#${newState.channelId}>)` }
                )
                .setTimestamp();
        }
        
        if (embed) {
            // Log to channel
            await logToChannel(guild, embed);
        }
    } catch (error) {
        console.error('[LOGGING] Error handling voice state update:', error);
    }
}

// Utility: Format channel type
function formatChannelType(type) {
    const types = {
        0: 'Text Channel',
        2: 'Voice Channel',
        4: 'Category',
        5: 'Announcement Channel',
        10: 'Announcement Thread',
        11: 'Public Thread',
        12: 'Private Thread',
        13: 'Stage Channel',
        14: 'Directory',
        15: 'Forum'
    };
    
    return types[type] || `Unknown (${type})`;
}

// Function to get the invite tracking channel
async function getInviteChannel(guild) {
    try {
        const config = Setup.loadServerConfig(guild.id);
        if (!config || !config.channels || !config.channels.invite_channel) {
            return null;
        }

        const channel = await guild.channels.fetch(config.channels.invite_channel.id);
        if (!channel || !channel.isTextBased()) {
            return null;
        }
        
        return channel;
    } catch (error) {
        console.error('Error getting invite channel:', error);
        return null;
    }
}

// Function to log invite events
async function logInvite(guild, embed) {
    try {
        const channel = await getInviteChannel(guild);
        if (!channel) return;

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error logging invite event:', error);
    }
}

// Initialize on module load
init();

module.exports = {
    handleMessageDelete,
    handleMessageUpdate,
    handleChannelCreate,
    handleChannelDelete,
    handleMemberJoin,
    handleMemberLeave,
    handleMemberUpdate,
    handleVoiceStateUpdate,
    logToChannel,
    logToFile,
    getLoggingChannel,
    logInvite
};
