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

// Delete role command
const deleteRoleCommand = {
    data: new SlashCommandBuilder()
        .setName('deleterole')
        .setDescription('Delete an existing role')
        .addRoleOption(option => 
            option.setName('role')
                .setDescription('The role to delete')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for deleting the role'))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    async execute(interaction) {
        try {
            const targetRole = interaction.options.getRole('role');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const modLogsChannel = await getConfiguredLogsChannel(interaction);
            
            if (!targetRole) {
                return interaction.reply({ content: 'Role not found.', ephemeral: true });
            }
            
            // Check if the bot has permission to manage the role
            if (targetRole.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.reply({ 
                    content: 'I cannot delete that role because it is higher than or equal to my highest role.', 
                    ephemeral: true 
                });
            }
            
            // Check if the user has permission to manage this role
            if (interaction.member.roles.highest.position <= targetRole.position) {
                return interaction.reply({ 
                    content: 'You cannot delete a role that is higher than or equal to your highest role.', 
                    ephemeral: true 
                });
            }
            
            // Store role info before deletion
            const roleInfo = {
                id: targetRole.id,
                name: targetRole.name,
                color: targetRole.hexColor,
                hoist: targetRole.hoist,
                mentionable: targetRole.mentionable,
                memberCount: targetRole.members.size
            };
            
            // Create an embed for the role deletion notification
            const deleteRoleEmbed = new EmbedBuilder()
                .setColor(targetRole.hexColor)
                .setTitle('🗑️ Role Deleted')
                .addFields(
                    { name: 'Role Name', value: targetRole.name },
                    { name: 'Role ID', value: targetRole.id },
                    { name: 'Member Count', value: `${targetRole.members.size}` },
                    { name: 'Deleted by', value: `${interaction.user.tag} (${interaction.user.id})` },
                    { name: 'Reason', value: reason },
                    { name: 'Time', value: new Date().toUTCString() }
                )
                .setTimestamp();
                
            // Log data for file logging
            const logData = {
                role: roleInfo,
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
            
            // Delete the role
            await targetRole.delete(`Deleted by ${interaction.user.tag}: ${reason}`);
            
            // Reply in the command channel
            await interaction.reply({ embeds: [deleteRoleEmbed] });
            
            // Log to mod-logs channel if provided
            if (modLogsChannel && modLogsChannel.isTextBased()) {
                try {
                    await modLogsChannel.send({ embeds: [deleteRoleEmbed] });
                } catch (err) {
                    console.error('Error sending to mod logs channel:', err);
                    await interaction.followUp({ 
                        content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Log to file
            logToFile('DELETE_ROLE', logData);
            
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
        }
    },
};

// Role all command - Add a role to all members
const roleAllCommand = {
    data: new SlashCommandBuilder()
        .setName('roleall')
        .setDescription('Add a role to all members')
        .addRoleOption(option => 
            option.setName('role')
                .setDescription('The role to add to all members')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for adding the role'))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        try {
            const targetRole = interaction.options.getRole('role');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const modLogsChannel = await getConfiguredLogsChannel(interaction);
            
            if (!targetRole) {
                return interaction.reply({ content: 'Role not found.', ephemeral: true });
            }
            
            // Check if the bot has permission to manage the role
            if (targetRole.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.reply({ 
                    content: 'I cannot assign that role because it is higher than or equal to my highest role.', 
                    ephemeral: true 
                });
            }
            
            // This operation can take a while, so defer the reply
            await interaction.deferReply();
            
            // Fetch all guild members - this might fetch in batches depending on guild size
            await interaction.guild.members.fetch();
            
            // Filter members who don't already have the role
            const membersToAddRole = interaction.guild.members.cache.filter(member => 
                !member.roles.cache.has(targetRole.id) && 
                !member.user.bot && 
                member.manageable
            );
            
            if (membersToAddRole.size === 0) {
                return interaction.editReply('All members already have this role or cannot be assigned this role.');
            }
            
            let successCount = 0;
            let failCount = 0;
            
            // Add role to each member
            const promises = membersToAddRole.map(async member => {
                try {
                    await member.roles.add(targetRole, reason);
                    successCount++;
                } catch (error) {
                    console.error(`Error adding role to ${member.user.tag}:`, error);
                    failCount++;
                }
            });
            
            // Wait for all role assignments to complete
            await Promise.all(promises);
            
            // Create an embed for the roleall notification
            const roleAllEmbed = new EmbedBuilder()
                .setColor(targetRole.hexColor)
                .setTitle('👥 Role Added to Multiple Members')
                .addFields(
                    { name: 'Role', value: `${targetRole.name} (${targetRole.id})` },
                    { name: 'Added by', value: `${interaction.user.tag} (${interaction.user.id})` },
                    { name: 'Successful Additions', value: `${successCount}` },
                    { name: 'Failed Additions', value: `${failCount}` },
                    { name: 'Reason', value: reason },
                    { name: 'Time', value: new Date().toUTCString() }
                )
                .setTimestamp();
                
            // Log data for file logging
            const logData = {
                role: {
                    id: targetRole.id,
                    name: targetRole.name
                },
                moderator: {
                    id: interaction.user.id,
                    tag: interaction.user.tag
                },
                reason: reason,
                successCount: successCount,
                failCount: failCount,
                guild: {
                    id: interaction.guild.id,
                    name: interaction.guild.name
                },
                timestamp: new Date().toISOString()
            };
            
            // Reply in the command channel
            await interaction.editReply({ embeds: [roleAllEmbed] });
            
            // Log to mod-logs channel if provided
            if (modLogsChannel && modLogsChannel.isTextBased()) {
                try {
                    await modLogsChannel.send({ embeds: [roleAllEmbed] });
                } catch (err) {
                    console.error('Error sending to mod logs channel:', err);
                    await interaction.followUp({ 
                        content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Log to file
            logToFile('ROLE_ALL', logData);
            
        } catch (error) {
            console.error(error);
            
            // Handle both deferred and non-deferred replies
            try {
                await interaction.editReply({ content: 'An error occurred while executing this command.' });
            } catch {
                await interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
            }
        }
    },
};

// Revoke role all command - Remove a role from all members
const revokeRoleAllCommand = {
    data: new SlashCommandBuilder()
        .setName('revokeroleall')
        .setDescription('Remove a role from all members')
        .addRoleOption(option => 
            option.setName('role')
                .setDescription('The role to remove from all members')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for removing the role'))
        .addChannelOption(option =>
            option.setName('modlogs')
                .setDescription('Channel to send moderation logs')
                .addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        try {
            const targetRole = interaction.options.getRole('role');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const modLogsChannel = await getConfiguredLogsChannel(interaction);
            
            if (!targetRole) {
                return interaction.reply({ content: 'Role not found.', ephemeral: true });
            }
            
            // Check if the bot has permission to manage the role
            if (targetRole.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.reply({ 
                    content: 'I cannot remove that role because it is higher than or equal to my highest role.', 
                    ephemeral: true 
                });
            }
            
            // This operation can take a while, so defer the reply
            await interaction.deferReply();
            
            // Fetch all guild members - this might fetch in batches depending on guild size
            await interaction.guild.members.fetch();
            
            // Filter members who have the role
            const membersToRemoveRole = interaction.guild.members.cache.filter(member => 
                member.roles.cache.has(targetRole.id) && 
                member.manageable
            );
            
            if (membersToRemoveRole.size === 0) {
                return interaction.editReply('No members have this role or the role cannot be removed from them.');
            }
            
            let successCount = 0;
            let failCount = 0;
            
            // Remove role from each member
            const promises = membersToRemoveRole.map(async member => {
                try {
                    await member.roles.remove(targetRole, reason);
                    successCount++;
                } catch (error) {
                    console.error(`Error removing role from ${member.user.tag}:`, error);
                    failCount++;
                }
            });
            
            // Wait for all role removals to complete
            await Promise.all(promises);
            
            // Create an embed for the revokeroleall notification
            const revokeRoleAllEmbed = new EmbedBuilder()
                .setColor(targetRole.hexColor)
                .setTitle('👥 Role Removed from Multiple Members')
                .addFields(
                    { name: 'Role', value: `${targetRole.name} (${targetRole.id})` },
                    { name: 'Removed by', value: `${interaction.user.tag} (${interaction.user.id})` },
                    { name: 'Successful Removals', value: `${successCount}` },
                    { name: 'Failed Removals', value: `${failCount}` },
                    { name: 'Reason', value: reason },
                    { name: 'Time', value: new Date().toUTCString() }
                )
                .setTimestamp();
                
            // Log data for file logging
            const logData = {
                role: {
                    id: targetRole.id,
                    name: targetRole.name
                },
                moderator: {
                    id: interaction.user.id,
                    tag: interaction.user.tag
                },
                reason: reason,
                successCount: successCount,
                failCount: failCount,
                guild: {
                    id: interaction.guild.id,
                    name: interaction.guild.name
                },
                timestamp: new Date().toISOString()
            };
            
            // Reply in the command channel
            await interaction.editReply({ embeds: [revokeRoleAllEmbed] });
            
            // Log to mod-logs channel if provided
            if (modLogsChannel && modLogsChannel.isTextBased()) {
                try {
                    await modLogsChannel.send({ embeds: [revokeRoleAllEmbed] });
                } catch (err) {
                    console.error('Error sending to mod logs channel:', err);
                    await interaction.followUp({ 
                        content: 'Could not send log to the specified mod-logs channel. Please check permissions.', 
                        ephemeral: true 
                    });
                }
            }
            
            // Log to file
            logToFile('REVOKE_ROLE_ALL', logData);
            
        } catch (error) {
            console.error(error);
            
            // Handle both deferred and non-deferred replies
            try {
                await interaction.editReply({ content: 'An error occurred while executing this command.' });
            } catch {
                await interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
            }
        }
    },
};

module.exports = {
    deleteRoleCommand,
    roleAllCommand,
    revokeRoleAllCommand
}; 