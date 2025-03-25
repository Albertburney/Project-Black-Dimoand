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

// Deafen command
const deafenCommand = {
    data: new SlashCommandBuilder()
        .setName('deafen')
        .setDescription('Deafen a user in a voice channel')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to deafen')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for deafening'))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers),
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
            
            if (!targetMember.voice.channel) {
                return interaction.reply({ content: 'This user is not in a voice channel.', ephemeral: true });
            }
            
            if (!targetMember.moderatable) {
                return interaction.reply({ content: 'I cannot deafen this user. They may have higher permissions than me.', ephemeral: true });
            }
            
            // Check if already deafened
            if (targetMember.voice.deaf) {
                return interaction.reply({ content: 'This user is already deafened.', ephemeral: true });
            }
            
            // Create an embed for the deafen notification
            const deafenEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('🔇 User Deafened')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})` },
                    { name: 'Deafened by', value: `${interaction.user.tag} (${interaction.user.id})` },
                    { name: 'Voice Channel', value: targetMember.voice.channel.name },
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
                voiceChannel: {
                    id: targetMember.voice.channel.id,
                    name: targetMember.voice.channel.name
                },
                reason: reason,
                guild: {
                    id: interaction.guild.id,
                    name: interaction.guild.name
                },
                timestamp: new Date().toISOString()
            };
            
            // Execute the deafen action
            await targetMember.voice.setDeaf(true, reason);
            
            // Reply in the command channel
            await interaction.reply({ embeds: [deafenEmbed] });
            
            // Log to mod-logs channel if provided
            if (modLogsChannel && modLogsChannel.isTextBased()) {
                try {
                    await modLogsChannel.send({ embeds: [deafenEmbed] });
                } catch (err) {
                    console.error('Error sending to mod logs channel:', err);
                    await interaction.followUp({ 
                        content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Log to file
            logToFile('DEAFEN', logData);
            
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
    },
};

// Undeafen command
const undeafenCommand = {
    data: new SlashCommandBuilder()
        .setName('undeafen')
        .setDescription('Undeafen a user in a voice channel')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to undeafen')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for undeafening'))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers),
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
            
            if (!targetMember.voice.channel) {
                return interaction.reply({ content: 'This user is not in a voice channel.', ephemeral: true });
            }
            
            if (!targetMember.moderatable) {
                return interaction.reply({ content: 'I cannot undeafen this user. They may have higher permissions than me.', ephemeral: true });
            }
            
            // Check if already undeafened
            if (!targetMember.voice.deaf) {
                return interaction.reply({ content: 'This user is not deafened.', ephemeral: true });
            }
            
            // Create an embed for the undeafen notification
            const undeafenEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🔊 User Undeafened')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})` },
                    { name: 'Undeafened by', value: `${interaction.user.tag} (${interaction.user.id})` },
                    { name: 'Voice Channel', value: targetMember.voice.channel.name },
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
                voiceChannel: {
                    id: targetMember.voice.channel.id,
                    name: targetMember.voice.channel.name
                },
                reason: reason,
                guild: {
                    id: interaction.guild.id,
                    name: interaction.guild.name
                },
                timestamp: new Date().toISOString()
            };
            
            // Execute the undeafen action
            await targetMember.voice.setDeaf(false, reason);
            
            // Reply in the command channel
            await interaction.reply({ embeds: [undeafenEmbed] });
            
            // Log to mod-logs channel if provided
            if (modLogsChannel && modLogsChannel.isTextBased()) {
                try {
                    await modLogsChannel.send({ embeds: [undeafenEmbed] });
                } catch (err) {
                    console.error('Error sending to mod logs channel:', err);
                    await interaction.followUp({ 
                        content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Log to file
            logToFile('UNDEAFEN', logData);
            
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
    },
};

module.exports = {
    deafenCommand,
    undeafenCommand
}; 