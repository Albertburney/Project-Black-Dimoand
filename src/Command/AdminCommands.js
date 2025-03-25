const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { setupCommand } = require('../Startup/Setup');
const { getUserWarnings, addWarning, removeWarning, shouldBeKicked } = require('./warningManager');
const { loadServerConfig } = require('../Startup/Setup');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Function to log moderation actions to a file
function logToFile(action, data) {
    const logFile = path.join(logsDir, 'logs.txt');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${action}: ${JSON.stringify(data)}\n`;
    
    fs.appendFile(logFile, logEntry, (err) => {
        if (err) console.error('Error writing to log file:', err);
    });
}

// Helper function to get the configured logs channel
async function getConfiguredLogsChannel(interaction) {
    // First check if a specific modlogs channel was provided with the command
    const specifiedChannel = interaction.options.getChannel('modlogs');
    if (specifiedChannel && specifiedChannel.isTextBased()) {
        return specifiedChannel;
    }
    
    // If not, try to get the configured logs channel from setup
    try {
        const config = loadServerConfig(interaction.guild.id);
        if (config && config.channels && config.channels.logs_channel) {
            // Try to fetch the channel to make sure it exists and is accessible
            const configuredChannel = await interaction.guild.channels.fetch(config.channels.logs_channel.id).catch(() => null);
            if (configuredChannel && configuredChannel.isTextBased()) {
                return configuredChannel;
            }
        }
    } catch (error) {
        console.error('Error loading configured logs channel:', error);
    }
    
    // If no channel was found, return null
    return null;
}

// Help command
const helpCommand = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Display available commands and how to use them')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    async execute(interaction) {
        try {
            // Check if server has a configured logs channel
            const config = loadServerConfig(interaction.guild.id);
            const logsConfigured = config && config.channels && config.channels.logs_channel;
            const logsChannelText = logsConfigured 
                ? `\n• Logs are automatically sent to <#${config.channels.logs_channel.id}>`
                : '\n• Use modlogs:[channel] to specify where to send logs';
            
            // Create embeds for different categories
            const generalEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📚 Black Diamond Bot Commands')
                .setDescription('Here are all the moderation commands available and how to use them. Use the dropdown menu to navigate between different command categories.')
                .setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { 
                        name: '⚙️ Setup',
                        value: '`/setup` - Configure the bot for your server\n' +
                               '• Sets up welcome, goodbye, logs and currency channels\n' +
                               '• Only available to server administrators'
                    }
                )
                .setFooter({ 
                    text: 'Required permissions vary by command • [ ] = required parameter, ( ) = optional parameter', 
                    iconURL: interaction.client.user.displayAvatarURL()
                })
                .setTimestamp();
            
            // User moderation commands
            const userModEmbed = new EmbedBuilder()
                .setColor(0xFF5555)
                .setTitle('👮 User Moderation Commands')
                .addFields(
                    { 
                        name: '👢 Kick',
                        value: '`/kick user:[user] reason:[text]`\n' +
                               '• Kicks a user from the server\n' +
                               '• Creates a moderation log entry' +
                               logsChannelText
                    },
                    { 
                        name: '🔨 Ban',
                        value: '`/ban user:[user] reason:[text] days:[0-7]`\n' +
                               '• Bans a user from the server\n' +
                               '• Optional: delete messages from last X days (0-7)' +
                               logsChannelText
                    },
                    { 
                        name: '🔓 Unban',
                        value: '`/unban userid:[ID] reason:[text]`\n' +
                               '• Unbans a user by their ID\n' +
                               '• Requires the user\'s ID (not their username)' +
                               logsChannelText
                    },
                    { 
                        name: '🧹 Softban',
                        value: '`/softban user:[user] days:[1-7] reason:[text]`\n' +
                               '• Bans and immediately unbans a user\n' +
                               '• Useful for removing messages without banning permanently' +
                               logsChannelText
                    },
                    { 
                        name: '🔇 Mute',
                        value: '`/mute user:[user] duration:[minutes] reason:[text]`\n' +
                               '• Times out a user for the specified duration\n' +
                               '• Duration is in minutes' +
                               logsChannelText
                    },
                    { 
                        name: '🔊 Unmute',
                        value: '`/unmute user:[user] reason:[text]`\n' +
                               '• Removes a timeout from a user' +
                               logsChannelText
                    },
                    { 
                        name: '⚠️ Warn',
                        value: '`/warn user:[user] reason:[text]`\n' +
                               '• Issues a warning to a user\n' +
                               '• Sends them a DM with the warning reason\n' +
                               '• After 5 warnings, user will be automatically kicked' +
                               logsChannelText
                    },
                    { 
                        name: '✅ Unwarn',
                        value: '`/unwarn user:[user] warnid:[ID or "all"]`\n' +
                               '• Removes a specific warning or all warnings\n' +
                               '• Use "all" to remove all warnings' +
                               logsChannelText
                    }
                );
                
            // Voice moderation commands
            const voiceModEmbed = new EmbedBuilder()
                .setColor(0x5555FF)
                .setTitle('🎙️ Voice Moderation Commands')
                .addFields(
                    { 
                        name: '🔇 Deafen',
                        value: '`/deafen user:[user] reason:[text]`\n' +
                               '• Deafens a user in a voice channel\n' +
                               '• User will not be able to hear others' +
                               logsChannelText
                    },
                    { 
                        name: '🔊 Undeafen',
                        value: '`/undeafen user:[user] reason:[text]`\n' +
                               '• Undeafens a user in a voice channel\n' +
                               '• Restores user\'s ability to hear others' +
                               logsChannelText
                    }
                );
                
            // Message moderation commands
            const messageModEmbed = new EmbedBuilder()
                .setColor(0x55FF55)
                .setTitle('💬 Message Moderation Commands')
                .addFields(
                    { 
                        name: '🧹 Purge',
                        value: '`/purge amount:[1-100] user:[optional]`\n' +
                               '• Bulk deletes messages from a channel\n' +
                               '• Can filter by user to only delete their messages\n' +
                               '• Limited to messages newer than 14 days' +
                               logsChannelText
                    }
                );
                
            // Channel management commands
            const channelEmbed = new EmbedBuilder()
                .setColor(0xFFAA00)
                .setTitle('📝 Channel Management Commands')
                .addFields(
                    { 
                        name: '⏱️ Slowmode',
                        value: '`/slowmode seconds:[0-21600] channel:[optional]`\n' +
                               '• Sets slowmode delay in a channel\n' +
                               '• Set to 0 to disable slowmode' +
                               logsChannelText
                    },
                    { 
                        name: '🔒 Lock',
                        value: '`/lock channel:[optional] reason:[text]`\n' +
                               '• Locks a channel to prevent members from sending messages\n' +
                               '• Will use current channel if none specified' +
                               logsChannelText
                    },
                    { 
                        name: '🔓 Unlock',
                        value: '`/unlock channel:[optional] reason:[text]`\n' +
                               '• Unlocks a previously locked channel\n' +
                               '• Will use current channel if none specified' +
                               logsChannelText
                    }
                );
                
            // Role management commands
            const roleEmbed = new EmbedBuilder()
                .setColor(0xFFAA55)
                .setTitle('👥 Role Management Commands')
                .addFields(
                    { 
                        name: '➕ Add Role',
                        value: '`/addrole user:[user] role:[role] reason:[text]`\n' +
                               '• Adds a role to a user' +
                               logsChannelText
                    },
                    { 
                        name: '➖ Remove Role',
                        value: '`/removerole user:[user] role:[role] reason:[text]`\n' +
                               '• Removes a role from a user' +
                               logsChannelText
                    },
                    { 
                        name: '✨ Create Role',
                        value: '`/createrole name:[text] color:[hex] hoist:[bool] mentionable:[bool]`\n' +
                               '• Creates a new role\n' +
                               '• Color should be a hex code (e.g. #FF0000)\n' +
                               '• Hoist determines if role is displayed separately' +
                               logsChannelText
                    },
                    { 
                        name: '🗑️ Delete Role',
                        value: '`/deleterole role:[role] reason:[text]`\n' +
                               '• Permanently deletes a role' +
                               logsChannelText
                    },
                    { 
                        name: '👥 Role All',
                        value: '`/roleall role:[role] reason:[text]`\n' +
                               '• Adds a role to all server members\n' +
                               '• May take some time in large servers' +
                               logsChannelText
                    },
                    { 
                        name: '👥 Revoke Role All',
                        value: '`/revokeroleall role:[role] reason:[text]`\n' +
                               '• Removes a role from all members who have it\n' +
                               '• May take some time in large servers' +
                               logsChannelText
                    }
                );
                
            // Communication commands
            const communicationEmbed = new EmbedBuilder()
                .setColor(0xAA55FF)
                .setTitle('📢 Communication Commands')
                .addFields(
                    { 
                        name: '📢 Announce',
                        value: '`/announce channel:[channel] title:[text] message:[text] color:[hex] ping:[bool]`\n' +
                               '• Sends an announcement to a channel\n' +
                               '• Can optionally ping @everyone with the ping parameter' +
                               logsChannelText
                    },
                    { 
                        name: '🔔 Ping Role',
                        value: '`/pingrole role:[role] channel:[channel] title:[text] message:[text] color:[hex]`\n' +
                               '• Sends an announcement pinging a specific role\n' +
                               '• Makes role pingable temporarily if needed' +
                               logsChannelText
                    },
                    { 
                        name: '✉️ DM',
                        value: '`/dm user:[user] message:[text] anonymous:[bool]`\n' +
                               '• Sends a DM to a user from the server\n' +
                               '• Can be sent anonymously to hide sender identity' +
                               logsChannelText
                    }
                );
            
            // Send the main help embed
            await interaction.reply({ embeds: [generalEmbed] });
            
            // Send each category embed as a follow-up
            await interaction.followUp({ embeds: [userModEmbed] });
            await interaction.followUp({ embeds: [voiceModEmbed] });
            await interaction.followUp({ embeds: [messageModEmbed] });
            await interaction.followUp({ embeds: [channelEmbed] });
            await interaction.followUp({ embeds: [roleEmbed] });
            await interaction.followUp({ embeds: [communicationEmbed] });
            
        } catch (error) {
            console.error('Error executing help command:', error);
            await interaction.reply({ 
                content: 'An error occurred while showing the help information.', 
                ephemeral: true 
            });
        }
    }
};

// Kick command
const kickCommand = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user from the server')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to kick')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for kicking'))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            if (!targetUser) {
                return interaction.reply({ content: 'User not found.', ephemeral: true });
            }
            
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const modLogsChannel = await getConfiguredLogsChannel(interaction);
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            
            if (!targetMember) {
                return interaction.reply({ content: 'Could not find that user in this server.', ephemeral: true });
            }
            
            if (!targetMember.kickable) {
                return interaction.reply({ content: 'I cannot kick this user. They may have higher permissions than me.', ephemeral: true });
            }
            
            // Create an embed for the kick notification
            const kickEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('User Kicked')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})` },
                    { name: 'Kicked by', value: `${interaction.user.tag} (${interaction.user.id})` },
                    { name: 'Reason', value: reason },
                    { name: 'Time', value: new Date().toUTCString() }
                )
                .setTimestamp();
                
            // Log data for file logging
            const logData = {
                user: {
                    id: targetUser.id,
                    tag: targetUser.tag
                },
                moderator: {
                    id: interaction.user.id,
                    tag: interaction.user.tag
                },
                reason: reason,
                guild: {
                    id: interaction.guild.id,
                    name: interaction.guild.name
                },
                timestamp: new Date().toISOString()
            };
            
            // Execute the kick
            await targetMember.kick(reason);
            
            // Reply in the command channel
            await interaction.reply({ embeds: [kickEmbed] });
            
            // Log to mod-logs channel if provided
            if (modLogsChannel && modLogsChannel.isTextBased()) {
                try {
                    await modLogsChannel.send({ embeds: [kickEmbed] });
                } catch (err) {
                    console.error('Error sending to mod logs channel:', err);
                    await interaction.followUp({ 
                        content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Log to file
            logToFile('KICK', logData);
            
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
    },
};

// Ban command
const banCommand = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from the server')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for banning'))
        .addIntegerOption(option =>
            option.setName('days')
                .setDescription('Number of days of messages to delete (0-7)')
                .setMinValue(0)
                .setMaxValue(7))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            if (!targetUser) {
                return interaction.reply({ content: 'User not found.', ephemeral: true });
            }
            
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const days = interaction.options.getInteger('days') || 0;
            const modLogsChannel = await getConfiguredLogsChannel(interaction);
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            
            if (!targetMember) {
                return interaction.reply({ content: 'Could not find that user in this server.', ephemeral: true });
            }
            
            if (!targetMember.bannable) {
                return interaction.reply({ content: 'I cannot ban this user. They may have higher permissions than me.', ephemeral: true });
            }
            
            // Create an embed for the ban notification
            const banEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🔨 User Banned')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})` },
                    { name: 'Banned by', value: `${interaction.user.tag} (${interaction.user.id})` },
                    { name: 'Reason', value: reason },
                    { name: 'Message Deletion', value: `${days} days` },
                    { name: 'Time', value: new Date().toUTCString() }
                )
                .setTimestamp();
                
            // Log data for file logging
            const logData = {
                user: {
                    id: targetUser.id,
                    tag: targetUser.tag
                },
                moderator: {
                    id: interaction.user.id,
                    tag: interaction.user.tag
                },
                reason: reason,
                days: days,
                guild: {
                    id: interaction.guild.id,
                    name: interaction.guild.name
                },
                timestamp: new Date().toISOString()
            };
            
            // Execute the ban
            await targetMember.ban({ deleteMessageDays: days, reason: reason });
            
            // Reply in the command channel
            await interaction.reply({ embeds: [banEmbed] });
            
            // Log to mod-logs channel if provided
            if (modLogsChannel && modLogsChannel.isTextBased()) {
                try {
                    await modLogsChannel.send({ embeds: [banEmbed] });
                } catch (err) {
                    console.error('Error sending to mod logs channel:', err);
                    await interaction.followUp({ 
                        content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Log to file
            logToFile('BAN', logData);
            
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
    },
};

// Unban command
const unbanCommand = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user from the server')
        .addStringOption(option => 
            option.setName('userid')
                .setDescription('The user ID to unban')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for unbanning'))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async execute(interaction) {
        try {
            const userId = interaction.options.getString('userid');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const modLogsChannel = await getConfiguredLogsChannel(interaction);
            
            // Fetch ban info to get user details if possible
            let userTag = 'Unknown User';
            let userAvatar = null;
            
            try {
                const banInfo = await interaction.guild.bans.fetch(userId);
                if (banInfo?.user) {
                    userTag = banInfo.user.tag;
                    userAvatar = banInfo.user.displayAvatarURL();
                }
            } catch (error) {
                console.log('Could not fetch ban info, continuing with unban...');
            }
            
            // Create an embed for the unban notification
            const unbanEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🔓 User Unbanned')
                .addFields(
                    { name: 'User', value: `${userTag} (${userId})` },
                    { name: 'Unbanned by', value: `${interaction.user.tag} (${interaction.user.id})` },
                    { name: 'Reason', value: reason },
                    { name: 'Time', value: new Date().toUTCString() }
                )
                .setTimestamp();
                
            if (userAvatar) {
                unbanEmbed.setThumbnail(userAvatar);
            }
                
            // Log data for file logging
            const logData = {
                user: {
                    id: userId,
                    tag: userTag
                },
                moderator: {
                    id: interaction.user.id,
                    tag: interaction.user.tag
                },
                reason: reason,
                guild: {
                    id: interaction.guild.id,
                    name: interaction.guild.name
                },
                timestamp: new Date().toISOString()
            };
            
            // Execute the unban
            await interaction.guild.members.unban(userId, reason);
            
            // Reply in the command channel
            await interaction.reply({ embeds: [unbanEmbed] });
            
            // Log to mod-logs channel if provided
            if (modLogsChannel && modLogsChannel.isTextBased()) {
                try {
                    await modLogsChannel.send({ embeds: [unbanEmbed] });
                } catch (err) {
                    console.error('Error sending to mod logs channel:', err);
                    await interaction.followUp({ 
                        content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Log to file
            logToFile('UNBAN', logData);
            
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Failed to unban user. They may not be banned or the ID might be invalid.', ephemeral: true });
        }
    },
};

// Mute command (timeout)
const muteCommand = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Timeout a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to timeout')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('duration')
                .setDescription('Timeout duration in minutes')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for timeout'))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            if (!targetUser) {
                return interaction.reply({ content: 'User not found.', ephemeral: true });
            }
            
            const duration = interaction.options.getInteger('duration');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const modLogsChannel = await getConfiguredLogsChannel(interaction);
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            
            if (!targetMember) {
                return interaction.reply({ content: 'Could not find that user in this server.', ephemeral: true });
            }
            
            if (!targetMember.moderatable) {
                return interaction.reply({ content: 'I cannot timeout this user. They may have higher permissions than me.', ephemeral: true });
            }
            
            // Convert minutes to milliseconds
            const timeoutDuration = duration * 60 * 1000;
            
            // Format duration for display
            let durationText;
            if (duration < 60) {
                durationText = `${duration} minute${duration === 1 ? '' : 's'}`;
            } else if (duration < 1440) {
                const hours = Math.floor(duration / 60);
                const minutes = duration % 60;
                durationText = `${hours} hour${hours === 1 ? '' : 's'}${minutes ? ` ${minutes} minute${minutes === 1 ? '' : 's'}` : ''}`;
            } else {
                const days = Math.floor(duration / 1440);
                const hours = Math.floor((duration % 1440) / 60);
                durationText = `${days} day${days === 1 ? '' : 's'}${hours ? ` ${hours} hour${hours === 1 ? '' : 's'}` : ''}`;
            }
            
            // Create an embed for the mute notification
            const muteEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('🔇 User Muted')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})` },
                    { name: 'Muted by', value: `${interaction.user.tag} (${interaction.user.id})` },
                    { name: 'Duration', value: durationText },
                    { name: 'Expires', value: new Date(Date.now() + timeoutDuration).toUTCString() },
                    { name: 'Reason', value: reason },
                    { name: 'Time', value: new Date().toUTCString() }
                )
                .setTimestamp();
                
            // Log data for file logging
            const logData = {
                user: {
                    id: targetUser.id,
                    tag: targetUser.tag
                },
                moderator: {
                    id: interaction.user.id,
                    tag: interaction.user.tag
                },
                duration: duration,
                durationText: durationText,
                reason: reason,
                expires: new Date(Date.now() + timeoutDuration).toISOString(),
                guild: {
                    id: interaction.guild.id,
                    name: interaction.guild.name
                },
                timestamp: new Date().toISOString()
            };
            
            // Execute the timeout
            await targetMember.timeout(timeoutDuration, reason);
            
            // Reply in the command channel
            await interaction.reply({ embeds: [muteEmbed] });
            
            // Log to mod-logs channel if provided
            if (modLogsChannel && modLogsChannel.isTextBased()) {
                try {
                    await modLogsChannel.send({ embeds: [muteEmbed] });
                } catch (err) {
                    console.error('Error sending to mod logs channel:', err);
                    await interaction.followUp({ 
                        content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Log to file
            logToFile('MUTE', logData);
            
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
    },
};

// Unmute command (remove timeout)
const unmuteCommand = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Remove timeout from a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to remove timeout from')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for removing timeout'))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            if (!targetUser) {
                return interaction.reply({ content: 'User not found.', ephemeral: true });
            }
            
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const modLogsChannel = await getConfiguredLogsChannel(interaction);
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            
            if (!targetMember) {
                return interaction.reply({ content: 'Could not find that user in this server.', ephemeral: true });
            }
            
            if (!targetMember.moderatable) {
                return interaction.reply({ content: 'I cannot modify this user. They may have higher permissions than me.', ephemeral: true });
            }
            
            // Check if user is actually timed out
            if (!targetMember.communicationDisabledUntil) {
                return interaction.reply({ content: 'This user is not currently muted (timed out).', ephemeral: true });
            }
            
            // Create an embed for the unmute notification
            const unmuteEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🔊 User Unmuted')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})` },
                    { name: 'Unmuted by', value: `${interaction.user.tag} (${interaction.user.id})` },
                    { name: 'Reason', value: reason },
                    { name: 'Time', value: new Date().toUTCString() }
                )
                .setTimestamp();
                
            // Log data for file logging
            const logData = {
                user: {
                    id: targetUser.id,
                    tag: targetUser.tag
                },
                moderator: {
                    id: interaction.user.id,
                    tag: interaction.user.tag
                },
                reason: reason,
                guild: {
                    id: interaction.guild.id,
                    name: interaction.guild.name
                },
                timestamp: new Date().toISOString()
            };
            
            // Remove timeout by setting it to null
            await targetMember.timeout(null, reason);
            
            // Reply in the command channel
            await interaction.reply({ embeds: [unmuteEmbed] });
            
            // Log to mod-logs channel if provided
            if (modLogsChannel && modLogsChannel.isTextBased()) {
                try {
                    await modLogsChannel.send({ embeds: [unmuteEmbed] });
                } catch (err) {
                    console.error('Error sending to mod logs channel:', err);
                    await interaction.followUp({ 
                        content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Log to file
            logToFile('UNMUTE', logData);
            
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
    },
};

// Warn command
const warnCommand = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to warn')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for warning')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            if (!targetUser) {
                return interaction.reply({ content: 'User not found.', ephemeral: true });
            }
            
            const reason = interaction.options.getString('reason');
            const modLogsChannel = await getConfiguredLogsChannel(interaction);
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            
            if (!targetMember) {
                return interaction.reply({ content: 'Could not find that user in this server.', ephemeral: true });
            }
            
            if (!targetMember.moderatable) {
                return interaction.reply({ content: 'I cannot warn this user. They may have higher permissions than me.', ephemeral: true });
            }
            
            // Add warning to the database
            const warnResult = addWarning(interaction.guild.id, targetUser.id, {
                reason: reason,
                moderator: {
                    id: interaction.user.id,
                    tag: interaction.user.tag
                }
            });
            
            // Create an embed for the warning notification
            const warnEmbed = new EmbedBuilder()
                .setColor(0xFFFF00)
                .setTitle('⚠️ User Warned')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})` },
                    { name: 'Warned by', value: `${interaction.user.tag} (${interaction.user.id})` },
                    { name: 'Reason', value: reason },
                    { name: 'Warning ID', value: warnResult.warning.id },
                    { name: 'Warning Count', value: `${warnResult.count}/5` },
                    { name: 'Time', value: new Date().toUTCString() }
                )
                .setTimestamp();
                
            // Log data for file logging
            const logData = {
                user: {
                    id: targetUser.id,
                    tag: targetUser.tag
                },
                moderator: {
                    id: interaction.user.id,
                    tag: interaction.user.tag
                },
                reason: reason,
                warningId: warnResult.warning.id,
                warningCount: warnResult.count,
                guild: {
                    id: interaction.guild.id,
                    name: interaction.guild.name
                },
                timestamp: new Date().toISOString()
            };
            
            // Reply in the command channel
            await interaction.reply({ embeds: [warnEmbed] });
            
            // Log to mod-logs channel if provided
            if (modLogsChannel && modLogsChannel.isTextBased()) {
                try {
                    await modLogsChannel.send({ embeds: [warnEmbed] });
                } catch (err) {
                    console.error('Error sending to mod logs channel:', err);
                    await interaction.followUp({ 
                        content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Log to file
            logToFile('WARN', logData);
            
            // Try to DM the user about the warning
            try {
                await targetUser.send({ content: `You were warned in ${interaction.guild.name} | Reason: ${reason} | Warning ${warnResult.count}/5` });
            } catch (dmError) {
                await interaction.followUp({ content: `Could not DM ${targetUser.tag} about the warning.`, ephemeral: true });
            }
            
            // Check if user has reached 5 warnings (auto-kick)
            if (warnResult.count >= 5) {
                // Only kick if user is kickable
                if (targetMember.kickable) {
                    try {
                        // Create an embed for the auto-kick notification
                        const kickEmbed = new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setTitle('👢 User Auto-Kicked')
                            .setThumbnail(targetUser.displayAvatarURL())
                            .addFields(
                                { name: 'User', value: `${targetUser.tag} (${targetUser.id})` },
                                { name: 'Kicked by', value: 'Automated system (5 warnings)' },
                                { name: 'Reason', value: 'Reached 5 warnings' },
                                { name: 'Time', value: new Date().toUTCString() }
                            )
                            .setTimestamp();
                            
                        // Execute the kick
                        await targetMember.kick('Automatic kick: Reached 5 warnings');
                        
                        // Send auto-kick notification to the channel
                        await interaction.followUp({ embeds: [kickEmbed] });
                        
                        // Log to mod-logs channel if provided
                        if (modLogsChannel && modLogsChannel.isTextBased()) {
                            try {
                                await modLogsChannel.send({ embeds: [kickEmbed] });
                            } catch (err) {
                                console.error('Error sending auto-kick notification to mod logs channel:', err);
                            }
                        }
                        
                        // Log to file
                        logToFile('AUTO_KICK', {
                            user: {
                                id: targetUser.id,
                                tag: targetUser.tag
                            },
                            reason: 'Automatic kick: Reached 5 warnings',
                            guild: {
                                id: interaction.guild.id,
                                name: interaction.guild.name
                            },
                            timestamp: new Date().toISOString()
                        });
                        
                    } catch (kickError) {
                        console.error('Error executing auto-kick:', kickError);
                        await interaction.followUp({ 
                            content: `User has reached 5 warnings and should be kicked, but an error occurred during the auto-kick process.`, 
                            ephemeral: true 
                        });
                    }
                } else {
                    await interaction.followUp({ 
                        content: `User has reached 5 warnings and should be kicked, but I don't have permission to kick them.`, 
                        ephemeral: true 
                    });
                }
            }
            
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
    },
};

// Unwarn command
const unwarnCommand = {
    data: new SlashCommandBuilder()
        .setName('unwarn')
        .setDescription('Remove a warning from a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to remove warning from')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('warnid')
                .setDescription('ID of the warning to remove (or "all")')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            if (!targetUser) {
                return interaction.reply({ content: 'User not found.', ephemeral: true });
            }
            
            const warnId = interaction.options.getString('warnid');
            const modLogsChannel = await getConfiguredLogsChannel(interaction);
            
            // Get the current warnings count for later reference
            const currentWarnings = getUserWarnings(interaction.guild.id, targetUser.id).length;
            
            // Attempt to remove the warning
            const result = removeWarning(interaction.guild.id, targetUser.id, warnId);
            
            if (!result.success) {
                return interaction.reply({ content: `Could not remove warning: ${result.reason}`, ephemeral: true });
            }
            
            // Create an embed for the unwarn notification
            const unwarnEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Warning Removed')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})` },
                    { name: 'Warning Removed by', value: `${interaction.user.tag} (${interaction.user.id})` },
                    { name: 'Warning ID', value: result.allRemoved ? 'All Warnings' : warnId },
                    { name: 'Warnings Remaining', value: `${result.count}/5` },
                    { name: 'Time', value: new Date().toUTCString() }
                )
                .setTimestamp();
                
            // Log data for file logging
            const logData = {
                user: {
                    id: targetUser.id,
                    tag: targetUser.tag
                },
                moderator: {
                    id: interaction.user.id,
                    tag: interaction.user.tag
                },
                warningId: warnId,
                allRemoved: result.allRemoved || false,
                previousCount: currentWarnings,
                newCount: result.count,
                guild: {
                    id: interaction.guild.id,
                    name: interaction.guild.name
                },
                timestamp: new Date().toISOString()
            };
            
            // Reply in the command channel
            await interaction.reply({ embeds: [unwarnEmbed] });
            
            // Log to mod-logs channel if provided
            if (modLogsChannel && modLogsChannel.isTextBased()) {
                try {
                    await modLogsChannel.send({ embeds: [unwarnEmbed] });
                } catch (err) {
                    console.error('Error sending to mod logs channel:', err);
                    await interaction.followUp({ 
                        content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Log to file
            logToFile('UNWARN', logData);
            
            // Try to DM the user about the warning removal
            try {
                if (result.allRemoved) {
                    await targetUser.send(`All of your warnings in ${interaction.guild.name} have been removed.`);
                } else {
                    await targetUser.send(`One of your warnings in ${interaction.guild.name} has been removed. You now have ${result.count} warning(s).`);
                }
            } catch (dmError) {
                await interaction.followUp({ content: `Could not DM ${targetUser.tag} about the warning removal.`, ephemeral: true });
            }
            
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
    },
};

// Export commands for registration
module.exports = {
    kickCommand,
    banCommand,
    unbanCommand,
    muteCommand,
    unmuteCommand,
    warnCommand,
    unwarnCommand,
    setupCommand,
    helpCommand,
};
