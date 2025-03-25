const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Store invites in memory
const guildInvites = new Map();

// Store invite data
const inviteData = new Map();

// Initialize invite tracking for a guild
async function initializeInviteTracking(guild) {
    try {
        const invites = await guild.invites.fetch();
        guildInvites.set(guild.id, new Map(invites.map((invite) => [invite.code, invite.uses])));
    } catch (error) {
        console.error('Error initializing invite tracking:', error);
    }
}

// Update invite tracking for a guild
async function updateInviteTracking(guild) {
    try {
        const invites = await guild.invites.fetch();
        const oldInvites = guildInvites.get(guild.id);
        const newInvites = new Map(invites.map((invite) => [invite.code, invite.uses]));

        // Compare old and new invites to find which invite was used
        for (const [code, uses] of newInvites) {
            if (oldInvites.get(code) < uses) {
                return code;
            }
        }
    } catch (error) {
        console.error('Error updating invite tracking:', error);
    }
    return null;
}

// Save invite data to file
function saveInviteData() {
    const data = {};
    for (const [guildId, guildData] of inviteData) {
        data[guildId] = {};
        for (const [userId, userData] of guildData) {
            data[guildId][userId] = userData;
        }
    }
    fs.writeFileSync(path.join(__dirname, '../../data/invites.json'), JSON.stringify(data, null, 2));
}

// Load invite data from file
function loadInviteData() {
    try {
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/invites.json'), 'utf8'));
        for (const [guildId, guildData] of Object.entries(data)) {
            inviteData.set(guildId, new Map(Object.entries(guildData)));
        }
    } catch (error) {
        console.error('Error loading invite data:', error);
    }
}

// Track invite usage
function trackInvite(guildId, userId, inviterId, inviteCode) {
    if (!inviteData.has(guildId)) {
        inviteData.set(guildId, new Map());
    }

    const guildData = inviteData.get(guildId);
    if (!guildData.has(userId)) {
        guildData.set(userId, {
            inviterId,
            inviteCode,
            joinedAt: Date.now()
        });
        saveInviteData();
    }
}

// Get invite leaderboard
function getInviteLeaderboard(guildId) {
    const guildData = inviteData.get(guildId);
    if (!guildData) return [];

    const inviterCounts = new Map();
    for (const [userId, data] of guildData) {
        if (!inviterCounts.has(data.inviterId)) {
            inviterCounts.set(data.inviterId, 0);
        }
        inviterCounts.set(data.inviterId, inviterCounts.get(data.inviterId) + 1);
    }

    return Array.from(inviterCounts.entries())
        .map(([inviterId, count]) => ({ inviterId, count }))
        .sort((a, b) => b.count - a.count);
}

// Get invite info for a user
function getInviteInfo(guildId, userId) {
    const guildData = inviteData.get(guildId);
    if (!guildData || !guildData.has(userId)) {
        return null;
    }
    return guildData.get(userId);
}

// Command definitions
const inviteCommands = [
    new SlashCommandBuilder()
        .setName('invites')
        .setDescription('View the invite leaderboard')
        .addSubcommand(subcommand =>
            subcommand
                .setName('leaderboard')
                .setDescription('View the invite leaderboard')),
    
    new SlashCommandBuilder()
        .setName('invitecheck')
        .setDescription('Check who invited a user')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to check')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
];

// Command handler
async function handleInviteCommand(interaction) {
    if (interaction.commandName === 'invites') {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'leaderboard') {
            const leaderboard = getInviteLeaderboard(interaction.guild.id);
            if (leaderboard.length === 0) {
                return interaction.reply('No invite data available yet.');
            }

            const embed = new EmbedBuilder()
                .setTitle('Invite Leaderboard')
                .setColor('#0099ff')
                .setDescription('Top 10 members with the most invites:')
                .setTimestamp();

            for (let i = 0; i < Math.min(10, leaderboard.length); i++) {
                const { inviterId, count } = leaderboard[i];
                const inviter = await interaction.client.users.fetch(inviterId);
                embed.addFields({
                    name: `${i + 1}. ${inviter.tag}`,
                    value: `${count} invites`
                });
            }

            await interaction.reply({ embeds: [embed] });
        }
    } else if (interaction.commandName === 'invitecheck') {
        const targetUser = interaction.options.getUser('user');
        const inviteInfo = getInviteInfo(interaction.guild.id, targetUser.id);

        if (!inviteInfo) {
            return interaction.reply(`No invite data found for ${targetUser.tag}`);
        }

        const inviter = await interaction.client.users.fetch(inviteInfo.inviterId);
        const joinedDate = new Date(inviteInfo.joinedAt).toLocaleDateString();

        const embed = new EmbedBuilder()
            .setTitle('Invite Information')
            .setColor('#0099ff')
            .addFields(
                { name: 'User', value: targetUser.tag, inline: true },
                { name: 'Invited By', value: inviter.tag, inline: true },
                { name: 'Joined On', value: joinedDate, inline: true },
                { name: 'Invite Code', value: inviteInfo.inviteCode, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
}

module.exports = {
    initializeInviteTracking,
    updateInviteTracking,
    trackInvite,
    inviteCommands,
    handleInviteCommand
};
