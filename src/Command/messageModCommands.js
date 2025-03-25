const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { loadServerConfig } = require('../Startup/Setup');

// Helper function to get the configured logs channel (same as in AdminCommands.js)
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

// Function to log moderation actions to a file (same as in AdminCommands.js)
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

// Softban command
const softbanCommand = {
    data: new SlashCommandBuilder()
        .setName('softban')
        .setDescription('Ban and immediately unban a user to delete their messages')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to softban')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('days')
                .setDescription('Number of days of messages to delete (1-7)')
                .setMinValue(1)
                .setMaxValue(7)
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for softbanning'))
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
            
            const days = interaction.options.getInteger('days');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const modLogsChannel = await getConfiguredLogsChannel(interaction);
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            
            if (!targetMember) {
                return interaction.reply({ content: 'Could not find that user in this server.', ephemeral: true });
            }
            
            if (!targetMember.bannable) {
                return interaction.reply({ content: 'I cannot ban this user. They may have higher permissions than me.', ephemeral: true });
            }
            
            // Create an embed for the softban notification
            const softbanEmbed = new EmbedBuilder()
                .setColor(0xFF9900)
                .setTitle('🧹 User Softbanned')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})` },
                    { name: 'Softbanned by', value: `${interaction.user.tag} (${interaction.user.id})` },
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
            
            // Execute the ban first
            await interaction.guild.members.ban(targetUser.id, { deleteMessageDays: days, reason: `Softban: ${reason}` });
            
            // Then immediately unban
            await interaction.guild.members.unban(targetUser.id, 'Softban: auto-unban');
            
            // Reply in the command channel
            await interaction.reply({ embeds: [softbanEmbed] });
            
            // Log to mod-logs channel if provided
            if (modLogsChannel && modLogsChannel.isTextBased()) {
                try {
                    await modLogsChannel.send({ embeds: [softbanEmbed] });
                } catch (err) {
                    console.error('Error sending to mod logs channel:', err);
                    await interaction.followUp({ 
                        content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Log to file
            logToFile('SOFTBAN', logData);
            
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
    },
};

// Purge command
const purgeCommand = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Bulk delete messages in a channel')
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true))
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Filter messages by user'))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
        try {
            const amount = interaction.options.getInteger('amount');
            const user = interaction.options.getUser('user');
            const modLogsChannel = await getConfiguredLogsChannel(interaction);
            
            // Need to defer the reply since message fetch and delete can take time
            await interaction.deferReply({ ephemeral: true });
            
            // Fetch messages - fetch more than we need if we're going to filter by user
            const fetchLimit = user ? Math.min(100, amount * 2) : amount;
            
            // Fetch messages
            const fetchedMessages = await interaction.channel.messages.fetch({ limit: fetchLimit });
            
            // Filter by user if specified
            let messagesToDelete = fetchedMessages;
            if (user) {
                messagesToDelete = fetchedMessages.filter(msg => msg.author.id === user.id);
                
                // Take only the amount specified
                messagesToDelete = new Map([...messagesToDelete.entries()].slice(0, amount));
                
                if (messagesToDelete.size === 0) {
                    return interaction.editReply({ content: `Could not find any recent messages from ${user.tag} to delete.` });
                }
            }
            
            // Make sure we're not trying to delete messages older than 14 days (Discord limitation)
            const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
            const validMessages = messagesToDelete.filter(msg => msg.createdTimestamp > twoWeeksAgo);
            
            if (validMessages.size === 0) {
                return interaction.editReply({ content: 'Could not delete any messages. Messages may be too old (>14 days).' });
            }
            
            // Create message array for bulk delete
            const messageArray = [...validMessages.values()];
            
            // Bulk delete messages
            const deletedCount = await interaction.channel.bulkDelete(messageArray, true)
                .then(deleted => deleted.size)
                .catch(error => {
                    console.error(error);
                    return 0;
                });
            
            // Create an embed for purge notification
            const purgeEmbed = new EmbedBuilder()
                .setColor(0x00AAFF)
                .setTitle('🧹 Messages Purged')
                .addFields(
                    { name: 'Channel', value: `<#${interaction.channelId}>` },
                    { name: 'Deleted by', value: `${interaction.user.tag} (${interaction.user.id})` },
                    { name: 'Messages Deleted', value: `${deletedCount}/${amount} requested` },
                    { name: 'User Filter', value: user ? `${user.tag} (${user.id})` : 'None' },
                    { name: 'Time', value: new Date().toUTCString() }
                )
                .setTimestamp();
                
            // Log data for file logging
            const logData = {
                channel: {
                    id: interaction.channelId,
                    name: interaction.channel.name
                },
                moderator: {
                    id: interaction.user.id,
                    tag: interaction.user.tag
                },
                deletedCount: deletedCount,
                requestedAmount: amount,
                userFilter: user ? {
                    id: user.id,
                    tag: user.tag
                } : null,
                guild: {
                    id: interaction.guild.id,
                    name: interaction.guild.name
                },
                timestamp: new Date().toISOString()
            };
            
            // Reply in the command channel
            await interaction.editReply({ content: `Successfully deleted ${deletedCount} message(s).` });
            
            // Log to mod-logs channel if provided
            if (modLogsChannel && modLogsChannel.isTextBased()) {
                try {
                    await modLogsChannel.send({ embeds: [purgeEmbed] });
                } catch (err) {
                    console.error('Error sending to mod logs channel:', err);
                    await interaction.followUp({ 
                        content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Log to file
            logToFile('PURGE', logData);
            
        } catch (error) {
            console.error(error);
            // Try to edit reply if it was deferred, otherwise send a new reply
            try {
                await interaction.editReply({ content: 'An error occurred while executing this command.' });
            } catch {
                await interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
            }
        }
    },
};

module.exports = {
    softbanCommand,
    purgeCommand
}; 