const { Events, EmbedBuilder } = require('discord.js');
const { initializeInviteTracking, updateInviteTracking, trackInvite } = require('./Invite');
const loggingSystem = require('../Security/Logging');

// Store the initial invites when the bot starts
let initialInvites = new Map();

// Initialize invite tracking for all guilds when the bot starts
async function initializeInviteSystem(client) {
    try {
        for (const guild of client.guilds.cache.values()) {
            await initializeInviteTracking(guild);
        }
        console.log('Invite tracking system initialized');
    } catch (error) {
        console.error('Error initializing invite system:', error);
    }
}

// Handle member join events
async function handleMemberJoin(member) {
    try {
        const usedInviteCode = await updateInviteTracking(member.guild);
        if (!usedInviteCode) return;

        // Get the invite that was used
        const invites = await member.guild.invites.fetch();
        const invite = invites.find(i => i.code === usedInviteCode);
        
        if (!invite) return;

        // Track the invite usage
        trackInvite(member.guild.id, member.id, invite.inviter.id, invite.code);
        
        // Update the stored invite count
        const guildInvites = initialInvites.get(member.guild.id);
        if (guildInvites) {
            guildInvites.set(usedInviteCode, invite.uses);
        }

        // Create embed for logging
        const embed = new EmbedBuilder()
            .setTitle('Member Joined')
            .setColor('#00ff00')
            .setDescription(`${member.user.tag} joined the server`)
            .addFields(
                { name: 'Invited By', value: invite.inviter.tag, inline: true },
                { name: 'Invite Code', value: invite.code, inline: true },
                { name: 'Total Invites', value: invite.uses.toString(), inline: true }
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        // Log to the invite tracking channel
        await loggingSystem.logInvite(member.guild, embed);

        console.log(`Member ${member.user.tag} joined using invite from ${invite.inviter.tag}`);
    } catch (error) {
        console.error('Error handling member join:', error);
    }
}

// Handle invite creation events
async function handleInviteCreate(invite) {
    try {
        const guildInvites = initialInvites.get(invite.guild.id);
        if (guildInvites) {
            guildInvites.set(invite.code, invite.uses);
        }

        // Create embed for logging
        const embed = new EmbedBuilder()
            .setTitle('New Invite Created')
            .setColor('#0099ff')
            .setDescription(`New invite created by ${invite.inviter.tag}`)
            .addFields(
                { name: 'Invite Code', value: invite.code, inline: true },
                { name: 'Max Uses', value: invite.maxUses ? invite.maxUses.toString() : 'Unlimited', inline: true },
                { name: 'Expires', value: invite.expiresAt ? new Date(invite.expiresAt).toLocaleString() : 'Never', inline: true }
            )
            .setTimestamp();

        // Log to the invite tracking channel
        await loggingSystem.logInvite(invite.guild, embed);

        console.log(`New invite created by ${invite.inviter.tag}`);
    } catch (error) {
        console.error('Error handling invite creation:', error);
    }
}

// Handle invite deletion events
async function handleInviteDelete(invite) {
    try {
        const guildInvites = initialInvites.get(invite.guild.id);
        if (guildInvites) {
            guildInvites.delete(invite.code);
        }

        // Create embed for logging
        const embed = new EmbedBuilder()
            .setTitle('Invite Deleted')
            .setColor('#ff0000')
            .setDescription(`Invite deleted: ${invite.code}`)
            .addFields(
                { name: 'Created By', value: invite.inviter.tag, inline: true },
                { name: 'Total Uses', value: invite.uses.toString(), inline: true }
            )
            .setTimestamp();

        // Log to the invite tracking channel
        await loggingSystem.logInvite(invite.guild, embed);

        console.log(`Invite deleted: ${invite.code}`);
    } catch (error) {
        console.error('Error handling invite deletion:', error);
    }
}

// Set up event listeners
function setupInviteListeners(client) {
    client.on(Events.GuildMemberAdd, handleMemberJoin);
    client.on(Events.InviteCreate, handleInviteCreate);
    client.on(Events.InviteDelete, handleInviteDelete);
}

module.exports = {
    initializeInviteSystem,
    setupInviteListeners
};
