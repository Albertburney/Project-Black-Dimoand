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

// Add role command
const addRoleCommand = {
    data: new SlashCommandBuilder()
        .setName('addrole')
        .setDescription('Add a role to a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to add the role to')
                .setRequired(true))
        .addRoleOption(option => 
            option.setName('role')
                .setDescription('The role to add')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for adding the role'))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            const targetRole = interaction.options.getRole('role');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const modLogsChannel = await getConfiguredLogsChannel(interaction);
            
            if (!targetUser || !targetRole) {
                return interaction.reply({ content: 'User or role not found.', ephemeral: true });
            }
            
            // Check if the bot has permission to manage the role
            if (targetRole.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.reply({ 
                    content: 'I cannot add that role because it is higher than or equal to my highest role.', 
                    ephemeral: true 
                });
            }
            
            // Check if the user has permission to manage this role
            if (interaction.member.roles.highest.position <= targetRole.position) {
                return interaction.reply({ 
                    content: 'You cannot add a role that is higher than or equal to your highest role.', 
                    ephemeral: true 
                });
            }
            
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (!targetMember) {
                return interaction.reply({ content: 'Could not find that user in this server.', ephemeral: true });
            }
            
            // Check if user already has the role
            if (targetMember.roles.cache.has(targetRole.id)) {
                return interaction.reply({ content: `${targetUser.tag} already has the ${targetRole.name} role.`, ephemeral: true });
            }
            
            // Create an embed for the role add notification
            const addRoleEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('➕ Role Added')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})` },
                    { name: 'Role Added', value: `${targetRole.name} (${targetRole.id})` },
                    { name: 'Added by', value: `${interaction.user.tag} (${interaction.user.id})` },
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
                role: {
                    id: targetRole.id,
                    name: targetRole.name
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
            
            // Add the role
            await targetMember.roles.add(targetRole, reason);
            
            // Reply in the command channel
            await interaction.reply({ embeds: [addRoleEmbed] });
            
            // Log to mod-logs channel if provided
            if (modLogsChannel && modLogsChannel.isTextBased()) {
                try {
                    await modLogsChannel.send({ embeds: [addRoleEmbed] });
                } catch (err) {
                    console.error('Error sending to mod logs channel:', err);
                    await interaction.followUp({ 
                        content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Log to file
            logToFile('ADD_ROLE', logData);
            
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
    },
};

// Remove role command
const removeRoleCommand = {
    data: new SlashCommandBuilder()
        .setName('removerole')
        .setDescription('Remove a role from a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to remove the role from')
                .setRequired(true))
        .addRoleOption(option => 
            option.setName('role')
                .setDescription('The role to remove')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for removing the role'))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            const targetRole = interaction.options.getRole('role');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const modLogsChannel = await getConfiguredLogsChannel(interaction);
            
            if (!targetUser || !targetRole) {
                return interaction.reply({ content: 'User or role not found.', ephemeral: true });
            }
            
            // Check if the bot has permission to manage the role
            if (targetRole.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.reply({ 
                    content: 'I cannot remove that role because it is higher than or equal to my highest role.', 
                    ephemeral: true 
                });
            }
            
            // Check if the user has permission to manage this role
            if (interaction.member.roles.highest.position <= targetRole.position) {
                return interaction.reply({ 
                    content: 'You cannot remove a role that is higher than or equal to your highest role.', 
                    ephemeral: true 
                });
            }
            
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (!targetMember) {
                return interaction.reply({ content: 'Could not find that user in this server.', ephemeral: true });
            }
            
            // Check if user has the role
            if (!targetMember.roles.cache.has(targetRole.id)) {
                return interaction.reply({ content: `${targetUser.tag} does not have the ${targetRole.name} role.`, ephemeral: true });
            }
            
            // Create an embed for the role remove notification
            const removeRoleEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('➖ Role Removed')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})` },
                    { name: 'Role Removed', value: `${targetRole.name} (${targetRole.id})` },
                    { name: 'Removed by', value: `${interaction.user.tag} (${interaction.user.id})` },
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
                role: {
                    id: targetRole.id,
                    name: targetRole.name
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
            
            // Remove the role
            await targetMember.roles.remove(targetRole, reason);
            
            // Reply in the command channel
            await interaction.reply({ embeds: [removeRoleEmbed] });
            
            // Log to mod-logs channel if provided
            if (modLogsChannel && modLogsChannel.isTextBased()) {
                try {
                    await modLogsChannel.send({ embeds: [removeRoleEmbed] });
                } catch (err) {
                    console.error('Error sending to mod logs channel:', err);
                    await interaction.followUp({ 
                        content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Log to file
            logToFile('REMOVE_ROLE', logData);
            
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
    },
};

// Create role command
const createRoleCommand = {
    data: new SlashCommandBuilder()
        .setName('createrole')
        .setDescription('Create a new role')
        .addStringOption(option => 
            option.setName('name')
                .setDescription('Name of the role')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('color')
                .setDescription('Color of the role (hex code)')
                .setRequired(false))
        .addBooleanOption(option => 
            option.setName('hoist')
                .setDescription('Whether to display role members separately'))
        .addBooleanOption(option => 
            option.setName('mentionable')
                .setDescription('Whether the role is mentionable'))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    async execute(interaction) {
        try {
            const name = interaction.options.getString('name');
            const color = interaction.options.getString('color') || '#000000';
            const hoist = interaction.options.getBoolean('hoist') || false;
            const mentionable = interaction.options.getBoolean('mentionable') || false;
            const modLogsChannel = await getConfiguredLogsChannel(interaction);
            
            // Validate hex color
            const colorRegex = /^#([0-9A-F]{6})$/i;
            let validColor = color;
            if (!colorRegex.test(color)) {
                validColor = '#000000'; // Default to black if invalid
            }
            
            // Create an embed for the role creation notification
            const createRoleEmbed = new EmbedBuilder()
                .setColor(validColor)
                .setTitle('✨ New Role Created')
                .addFields(
                    { name: 'Role Name', value: name },
                    { name: 'Color', value: validColor },
                    { name: 'Hoisted', value: hoist ? 'Yes' : 'No' },
                    { name: 'Mentionable', value: mentionable ? 'Yes' : 'No' },
                    { name: 'Created by', value: `${interaction.user.tag} (${interaction.user.id})` },
                    { name: 'Time', value: new Date().toUTCString() }
                )
                .setTimestamp();
                
            // Create the role
            const newRole = await interaction.guild.roles.create({
                name: name,
                color: validColor,
                hoist: hoist,
                mentionable: mentionable,
                reason: `Role created by ${interaction.user.tag}`
            });
            
            // Add role ID to the embed
            createRoleEmbed.addFields({ name: 'Role ID', value: newRole.id });
            
            // Log data for file logging
            const logData = {
                role: {
                    id: newRole.id,
                    name: newRole.name,
                    color: validColor,
                    hoist: hoist,
                    mentionable: mentionable
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
            
            // Reply in the command channel
            await interaction.reply({ embeds: [createRoleEmbed] });
            
            // Log to mod-logs channel if provided
            if (modLogsChannel && modLogsChannel.isTextBased()) {
                try {
                    await modLogsChannel.send({ embeds: [createRoleEmbed] });
                } catch (err) {
                    console.error('Error sending to mod logs channel:', err);
                    await interaction.followUp({ 
                        content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Log to file
            logToFile('CREATE_ROLE', logData);
            
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
    },
};

module.exports = {
    addRoleCommand,
    removeRoleCommand,
    createRoleCommand
}; 