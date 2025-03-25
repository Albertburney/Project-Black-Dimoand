const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { loadServerConfig } = require('../Startup/Setup');

// Helper function to get the configured logs channel (same as in AdminCommands.js)
async function getConfiguredLogsChannel(interaction) {
    const specifiedChannel = interaction.options.getChannel('modlogs');
    if (specifiedChannel && specifiedChannel.isTextBased()) {
        return specifiedChannel;
    }
    
    try {
        const config = loadServerConfig(interaction.guild.id);
        if (config && config.channels && config.channels.logs_channel) {
            const configuredChannel = await interaction.guild.channels.fetch(config.channels.logs_channel.id).catch(() => null);
            if (configuredChannel && configuredChannel.isTextBased()) {
                return configuredChannel;
            }
        }
    } catch (error) {
        console.error('Error loading configured logs channel:', error);
    }
    
    return null;
}

// Function to log moderation actions to a file
function logToFile(action, data) {
    const logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const logFile = path.join(logsDir, 'logs.txt');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${action}: ${JSON.stringify(data)}\n`;
    
    fs.appendFile(logFile, logEntry, (err) => {
        if (err) console.error('Error writing to log file:', err);
    });
}

// Announce command
const announceCommand = {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Send an announcement to a channel')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('Channel to send the announcement to')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addStringOption(option => 
            option.setName('title')
                .setDescription('Title of the announcement')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('message')
                .setDescription('Content of the announcement')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('color')
                .setDescription('Color of the embed (hex code)'))
        .addBooleanOption(option => 
            option.setName('ping')
                .setDescription('Whether to ping @everyone'))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
        try {
            const targetChannel = interaction.options.getChannel('channel');
            const title = interaction.options.getString('title');
            const message = interaction.options.getString('message');
            const color = interaction.options.getString('color') || '#0099ff';
            const shouldPing = interaction.options.getBoolean('ping') || false;
            const modLogsChannel = await getConfiguredLogsChannel(interaction);
            
            if (!targetChannel.isTextBased()) {
                return interaction.reply({ content: 'The specified channel is not a text channel.', ephemeral: true });
            }
            
            // Validate hex color
            const colorRegex = /^#([0-9A-F]{6})$/i;
            let validColor = color;
            if (!colorRegex.test(color)) {
                validColor = '#0099ff'; // Default to Discord blue if invalid
            }
            
            // Create an embed for the announcement
            const announceEmbed = new EmbedBuilder()
                .setColor(validColor)
                .setTitle(title)
                .setDescription(message)
                .setFooter({ 
                    text: `Announcement by ${interaction.user.tag}`, 
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();
            
            // Create log embed
            const logEmbed = new EmbedBuilder()
                .setColor(validColor)
                .setTitle('📢 Announcement Sent')
                .addFields(
                    { name: 'Channel', value: `<#${targetChannel.id}>` },
                    { name: 'Title', value: title },
                    { name: 'Content', value: message.length > 1024 ? message.substring(0, 1021) + '...' : message },
                    { name: 'Pinged Everyone', value: shouldPing ? 'Yes' : 'No' },
                    { name: 'Sent by', value: `${interaction.user.tag} (${interaction.user.id})` },
                    { name: 'Time', value: new Date().toUTCString() }
                )
                .setTimestamp();
                
            // Log data for file logging
            const logData = {
                channel: {
                    id: targetChannel.id,
                    name: targetChannel.name
                },
                announcement: {
                    title: title,
                    message: message,
                    color: validColor,
                    pingEveryone: shouldPing
                },
                moderator: {
                    id: interaction.user.id,
                    tag: interaction.user.tag
                },
                guild: {
                    id: interaction.guild.id,
                    name: interaction.guild.name
                },
                timestamp: new Date().toISOString()
            };
            
            // Send the announcement
            if (shouldPing) {
                await targetChannel.send({ content: '@everyone', embeds: [announceEmbed] });
            } else {
                await targetChannel.send({ embeds: [announceEmbed] });
            }
            
            // Reply in the command channel
            await interaction.reply({ 
                content: `Announcement successfully sent to <#${targetChannel.id}>!`, 
                embeds: [logEmbed],
                ephemeral: true 
            });
            
            // Log to mod-logs channel if provided
            if (modLogsChannel && modLogsChannel.isTextBased()) {
                try {
                    await modLogsChannel.send({ embeds: [logEmbed] });
                } catch (err) {
                    console.error('Error sending to mod logs channel:', err);
                    await interaction.followUp({ 
                        content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Log to file
            logToFile('ANNOUNCE', logData);
            
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
    },
};

// Ping role command
const pingRoleCommand = {
    data: new SlashCommandBuilder()
        .setName('pingrole')
        .setDescription('Ping a specific role in an announcement')
        .addRoleOption(option => 
            option.setName('role')
                .setDescription('Role to ping')
                .setRequired(true))
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('Channel to send the announcement to')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addStringOption(option => 
            option.setName('title')
                .setDescription('Title of the announcement')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('message')
                .setDescription('Content of the announcement')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('color')
                .setDescription('Color of the embed (hex code)'))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.MentionEveryone),
    async execute(interaction) {
        try {
            const targetRole = interaction.options.getRole('role');
            const targetChannel = interaction.options.getChannel('channel');
            const title = interaction.options.getString('title');
            const message = interaction.options.getString('message');
            const color = interaction.options.getString('color') || '#0099ff';
            const modLogsChannel = await getConfiguredLogsChannel(interaction);
            
            if (!targetChannel.isTextBased()) {
                return interaction.reply({ content: 'The specified channel is not a text channel.', ephemeral: true });
            }
            
            // Check if role is mentionable, if not, make it temporarily mentionable
            const wasAlreadyMentionable = targetRole.mentionable;
            let roleChanged = false;
            
            // Validate hex color
            const colorRegex = /^#([0-9A-F]{6})$/i;
            let validColor = color;
            if (!colorRegex.test(color)) {
                validColor = '#0099ff'; // Default to Discord blue if invalid
            }
            
            // Create an embed for the announcement
            const announceEmbed = new EmbedBuilder()
                .setColor(validColor)
                .setTitle(title)
                .setDescription(message)
                .setFooter({ 
                    text: `Announcement by ${interaction.user.tag}`, 
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();
            
            // Create log embed
            const logEmbed = new EmbedBuilder()
                .setColor(validColor)
                .setTitle('🔔 Role Ping Announcement Sent')
                .addFields(
                    { name: 'Role Pinged', value: `<@&${targetRole.id}>` },
                    { name: 'Channel', value: `<#${targetChannel.id}>` },
                    { name: 'Title', value: title },
                    { name: 'Content', value: message.length > 1024 ? message.substring(0, 1021) + '...' : message },
                    { name: 'Sent by', value: `${interaction.user.tag} (${interaction.user.id})` },
                    { name: 'Time', value: new Date().toUTCString() }
                )
                .setTimestamp();
                
            // Log data for file logging
            const logData = {
                role: {
                    id: targetRole.id,
                    name: targetRole.name
                },
                channel: {
                    id: targetChannel.id,
                    name: targetChannel.name
                },
                announcement: {
                    title: title,
                    message: message,
                    color: validColor
                },
                moderator: {
                    id: interaction.user.id,
                    tag: interaction.user.tag
                },
                guild: {
                    id: interaction.guild.id,
                    name: interaction.guild.name
                },
                timestamp: new Date().toISOString()
            };
            
            try {
                // Make role mentionable if needed
                if (!wasAlreadyMentionable && targetRole.editable) {
                    await targetRole.setMentionable(true, 'Temporary for announcement ping');
                    roleChanged = true;
                }
                
                // Send the announcement with the role ping
                await targetChannel.send({ content: `<@&${targetRole.id}>`, embeds: [announceEmbed] });
                
                // Set role back to non-mentionable if it was changed
                if (roleChanged) {
                    await targetRole.setMentionable(false, 'Reverting after announcement ping');
                }
                
                // Reply in the command channel
                await interaction.reply({ 
                    content: `Announcement with role ping successfully sent to <#${targetChannel.id}>!`, 
                    embeds: [logEmbed],
                    ephemeral: true 
                });
                
                // Log to mod-logs channel if provided
                if (modLogsChannel && modLogsChannel.isTextBased()) {
                    try {
                        await modLogsChannel.send({ embeds: [logEmbed] });
                    } catch (err) {
                        console.error('Error sending to mod logs channel:', err);
                        await interaction.followUp({ 
                            content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                            ephemeral: true 
                        });
                    }
                }
                
                // Log to file
                logToFile('PING_ROLE', logData);
                
            } catch (error) {
                // Ensure role is set back to original state if an error occurs
                if (roleChanged) {
                    try {
                        await targetRole.setMentionable(false, 'Reverting after error');
                    } catch {
                        console.error('Error reverting role mentionable status');
                    }
                }
                throw error;
            }
            
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
    },
};

// DM command
const dmCommand = {
    data: new SlashCommandBuilder()
        .setName('dm')
        .setDescription('Send a private message to a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to send the DM to')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('message')
                .setDescription('Message to send')
                .setRequired(true))
        .addBooleanOption(option => 
            option.setName('anonymous')
                .setDescription('Send as anonymous message (hides sender identity)'))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            const message = interaction.options.getString('message');
            const anonymous = interaction.options.getBoolean('anonymous') || false;
            const modLogsChannel = await getConfiguredLogsChannel(interaction);
            
            // Create the DM message content
            let dmContent;
            if (anonymous) {
                dmContent = `**Anonymous message from ${interaction.guild.name} staff:**\n\n${message}`;
            } else {
                dmContent = `**Message from ${interaction.user.tag} (${interaction.guild.name} staff):**\n\n${message}`;
            }
            
            // Create an embed for logging
            const dmLogEmbed = new EmbedBuilder()
                .setColor(0x00AAFF)
                .setTitle('✉️ Direct Message Sent')
                .addFields(
                    { name: 'To User', value: `${targetUser.tag} (${targetUser.id})` },
                    { name: 'From', value: `${interaction.user.tag} (${interaction.user.id})` },
                    { name: 'Sent as Anonymous', value: anonymous ? 'Yes' : 'No' },
                    { name: 'Message', value: message.length > 1024 ? message.substring(0, 1021) + '...' : message },
                    { name: 'Time', value: new Date().toUTCString() }
                )
                .setTimestamp();
                
            // Log data for file logging
            const logData = {
                recipient: {
                    id: targetUser.id,
                    tag: targetUser.tag
                },
                sender: {
                    id: interaction.user.id,
                    tag: interaction.user.tag
                },
                message: message,
                anonymous: anonymous,
                guild: {
                    id: interaction.guild.id,
                    name: interaction.guild.name
                },
                timestamp: new Date().toISOString()
            };
            
            // Send the DM
            try {
                await targetUser.send(dmContent);
                
                // Reply in the command channel
                await interaction.reply({ 
                    content: `Message successfully sent to ${targetUser.tag}!`, 
                    embeds: [dmLogEmbed],
                    ephemeral: true
                });
                
                // Log to mod-logs channel if provided
                if (modLogsChannel && modLogsChannel.isTextBased()) {
                    try {
                        await modLogsChannel.send({ embeds: [dmLogEmbed] });
                    } catch (err) {
                        console.error('Error sending to mod logs channel:', err);
                        await interaction.followUp({ 
                            content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                            ephemeral: true 
                        });
                    }
                }
                
                // Log to file
                logToFile('DM', logData);
                
            } catch (dmError) {
                // Handle case where user has DMs closed
                await interaction.reply({ 
                    content: `Failed to send message to ${targetUser.tag}. They may have DMs closed or have blocked the bot.`, 
                    ephemeral: true 
                });
            }
            
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
    },
};

module.exports = {
    announceCommand,
    pingRoleCommand,
    dmCommand
}; 