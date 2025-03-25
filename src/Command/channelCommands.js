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

// Slowmode command
const slowmodeCommand = {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set slowmode in a channel')
        .addIntegerOption(option => 
            option.setName('seconds')
                .setDescription('Slowmode delay in seconds (0 to disable)')
                .setMinValue(0)
                .setMaxValue(21600) // 6 hours max
                .setRequired(true))
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('Channel to set slowmode in (defaults to current channel)')
                .addChannelTypes(ChannelType.GuildText))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for setting slowmode'))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
        try {
            const seconds = interaction.options.getInteger('seconds');
            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const modLogsChannel = await getConfiguredLogsChannel(interaction);
            
            if (!targetChannel.isTextBased() || targetChannel.isVoiceBased()) {
                return interaction.reply({ content: 'Slowmode can only be set in text channels.', ephemeral: true });
            }
            
            // Format duration for display
            let durationText;
            if (seconds === 0) {
                durationText = 'Disabled';
            } else if (seconds < 60) {
                durationText = `${seconds} second${seconds === 1 ? '' : 's'}`;
            } else if (seconds < 3600) {
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = seconds % 60;
                durationText = `${minutes} minute${minutes === 1 ? '' : 's'}${remainingSeconds ? ` ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'}` : ''}`;
            } else {
                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                durationText = `${hours} hour${hours === 1 ? '' : 's'}${minutes ? ` ${minutes} minute${minutes === 1 ? '' : 's'}` : ''}`;
            }
            
            // Create an embed for the slowmode notification
            const slowmodeEmbed = new EmbedBuilder()
                .setColor(seconds === 0 ? 0x00FF00 : 0xFFA500)
                .setTitle(`⏱️ Slowmode ${seconds === 0 ? 'Disabled' : 'Enabled'}`)
                .addFields(
                    { name: 'Channel', value: `<#${targetChannel.id}>` },
                    { name: 'Set by', value: `${interaction.user.tag} (${interaction.user.id})` },
                    { name: 'Slowmode Delay', value: durationText },
                    { name: 'Reason', value: reason },
                    { name: 'Time', value: new Date().toUTCString() }
                )
                .setTimestamp();
                
            // Log data for file logging
            const logData = {
                channel: {
                    id: targetChannel.id,
                    name: targetChannel.name
                },
                moderator: {
                    id: interaction.user.id,
                    tag: interaction.user.tag
                },
                seconds: seconds,
                durationText: durationText,
                reason: reason,
                guild: {
                    id: interaction.guild.id,
                    name: interaction.guild.name
                },
                timestamp: new Date().toISOString()
            };
            
            // Set the slowmode
            await targetChannel.setRateLimitPerUser(seconds, reason);
            
            // Reply in the command channel
            await interaction.reply({ embeds: [slowmodeEmbed] });
            
            // Log to mod-logs channel if provided
            if (modLogsChannel && modLogsChannel.isTextBased()) {
                try {
                    await modLogsChannel.send({ embeds: [slowmodeEmbed] });
                } catch (err) {
                    console.error('Error sending to mod logs channel:', err);
                    await interaction.followUp({ 
                        content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Log to file
            logToFile('SLOWMODE', logData);
            
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
    },
};

// Lock command
const lockCommand = {
    data: new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Lock a channel to prevent message sending')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('Channel to lock (defaults to current channel)')
                .addChannelTypes(ChannelType.GuildText))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for locking the channel'))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
        try {
            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const modLogsChannel = await getConfiguredLogsChannel(interaction);
            
            if (!targetChannel.isTextBased() || targetChannel.isVoiceBased()) {
                return interaction.reply({ content: 'This command only works on text channels.', ephemeral: true });
            }
            
            // Check if channel is already locked for @everyone
            const everyoneRole = interaction.guild.roles.everyone;
            const currentPermissions = targetChannel.permissionsFor(everyoneRole);
            
            if (!currentPermissions.has('SendMessages')) {
                return interaction.reply({ content: 'This channel is already locked.', ephemeral: true });
            }
            
            // Create an embed for the lock notification
            const lockEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🔒 Channel Locked')
                .addFields(
                    { name: 'Channel', value: `<#${targetChannel.id}>` },
                    { name: 'Locked by', value: `${interaction.user.tag} (${interaction.user.id})` },
                    { name: 'Reason', value: reason },
                    { name: 'Time', value: new Date().toUTCString() }
                )
                .setTimestamp();
                
            // Log data for file logging
            const logData = {
                channel: {
                    id: targetChannel.id,
                    name: targetChannel.name
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
            
            // Lock the channel by denying SendMessages for @everyone
            await targetChannel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: false
            }, { reason: `Channel locked by ${interaction.user.tag}: ${reason}` });
            
            // Reply in the command channel
            await interaction.reply({ embeds: [lockEmbed] });
            
            // Send a message to the locked channel
            if (targetChannel.id !== interaction.channelId) {
                await targetChannel.send({ embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('🔒 This channel has been locked')
                        .setDescription(`**Reason:** ${reason}`)
                        .setFooter({ text: `Locked by ${interaction.user.tag}` })
                        .setTimestamp()
                ] });
            }
            
            // Log to mod-logs channel if provided
            if (modLogsChannel && modLogsChannel.isTextBased()) {
                try {
                    await modLogsChannel.send({ embeds: [lockEmbed] });
                } catch (err) {
                    console.error('Error sending to mod logs channel:', err);
                    await interaction.followUp({ 
                        content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Log to file
            logToFile('LOCK', logData);
            
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
    },
};

// Unlock command
const unlockCommand = {
    data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock a previously locked channel')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('Channel to unlock (defaults to current channel)')
                .addChannelTypes(ChannelType.GuildText))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for unlocking the channel'))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
        try {
            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const modLogsChannel = await getConfiguredLogsChannel(interaction);
            
            if (!targetChannel.isTextBased() || targetChannel.isVoiceBased()) {
                return interaction.reply({ content: 'This command only works on text channels.', ephemeral: true });
            }
            
            // Check if channel is actually locked for @everyone
            const everyoneRole = interaction.guild.roles.everyone;
            const currentPermissions = targetChannel.permissionsFor(everyoneRole);
            
            if (currentPermissions.has('SendMessages')) {
                return interaction.reply({ content: 'This channel is not locked.', ephemeral: true });
            }
            
            // Create an embed for the unlock notification
            const unlockEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🔓 Channel Unlocked')
                .addFields(
                    { name: 'Channel', value: `<#${targetChannel.id}>` },
                    { name: 'Unlocked by', value: `${interaction.user.tag} (${interaction.user.id})` },
                    { name: 'Reason', value: reason },
                    { name: 'Time', value: new Date().toUTCString() }
                )
                .setTimestamp();
                
            // Log data for file logging
            const logData = {
                channel: {
                    id: targetChannel.id,
                    name: targetChannel.name
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
            
            // Unlock the channel by resetting SendMessages for @everyone
            await targetChannel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: null
            }, { reason: `Channel unlocked by ${interaction.user.tag}: ${reason}` });
            
            // Reply in the command channel
            await interaction.reply({ embeds: [unlockEmbed] });
            
            // Send a message to the unlocked channel
            if (targetChannel.id !== interaction.channelId) {
                await targetChannel.send({ embeds: [
                    new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('🔓 This channel has been unlocked')
                        .setDescription(`**Reason:** ${reason}`)
                        .setFooter({ text: `Unlocked by ${interaction.user.tag}` })
                        .setTimestamp()
                ] });
            }
            
            // Log to mod-logs channel if provided
            if (modLogsChannel && modLogsChannel.isTextBased()) {
                try {
                    await modLogsChannel.send({ embeds: [unlockEmbed] });
                } catch (err) {
                    console.error('Error sending to mod logs channel:', err);
                    await interaction.followUp({ 
                        content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Log to file
            logToFile('UNLOCK', logData);
            
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
    },
};

module.exports = {
    slowmodeCommand,
    lockCommand,
    unlockCommand
}; 