const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const securityHandler = require('./syshandling');

// Track recent joins for each guild
const recentJoins = new Map();

// Initialize module
function init() {
    console.log('[SECURITY] AntiRaid system loaded');
    
    // Clean up old entries every minute
    setInterval(cleanupOldEntries, 60000);
    
    return true;
}

/**
 * Clean up old entries from the recent joins tracker
 */
function cleanupOldEntries() {
    const now = Date.now();
    
    // For each guild in the tracker
    recentJoins.forEach((joins, guildId) => {
        // Filter out joins that are older than 1 hour
        const filteredJoins = joins.filter(join => (now - join.timestamp) < 3600000);
        
        if (filteredJoins.length === 0) {
            // Remove guild entry if no recent joins
            recentJoins.delete(guildId);
        } else {
            // Update with filtered list
            recentJoins.set(guildId, filteredJoins);
        }
    });
}

/**
 * Process a member join event for raid detection
 * @param {GuildMember} member - Discord.js GuildMember object
 * @param {Object} config - Anti-raid configuration for the guild
 */
async function processMemberJoin(member, config) {
    try {
        const guildId = member.guild.id;
        const now = Date.now();
        
        // Initialize or get recent joins for this guild
        if (!recentJoins.has(guildId)) {
            recentJoins.set(guildId, []);
        }
        
        const guildJoins = recentJoins.get(guildId);
        
        // Add this join to the tracker
        guildJoins.push({
            userId: member.id,
            username: member.user.tag,
            timestamp: now
        });
        
        // Update the tracker
        recentJoins.set(guildId, guildJoins);
        
        // Check for raid (multiple joins in a short time)
        const recentTimeThreshold = now - (config.timeThreshold * 1000);
        const recentJoinsCount = guildJoins.filter(join => join.timestamp >= recentTimeThreshold).length;
        
        // If we've hit the threshold, trigger anti-raid measures
        if (recentJoinsCount >= config.joinThreshold) {
            console.log(`[SECURITY] Raid detected in ${member.guild.name}: ${recentJoinsCount} joins in ${config.timeThreshold} seconds`);
            
            // Take action based on configured action
            await takeAntiRaidAction(member.guild, config, recentJoinsCount);
        }
    } catch (error) {
        console.error('[SECURITY] Error in anti-raid system:', error);
    }
}

/**
 * Take action against a detected raid
 * @param {Guild} guild - Discord.js Guild object
 * @param {Object} config - Anti-raid configuration
 * @param {number} joinCount - Number of recent joins that triggered the detection
 */
async function takeAntiRaidAction(guild, config, joinCount) {
    try {
        // Get the action to take
        const action = config.action;
        
        // Create a log entry
        const logData = {
            guild: {
                id: guild.id,
                name: guild.name
            },
            joinCount: joinCount,
            timeWindow: config.timeThreshold,
            action: action,
            timestamp: new Date().toISOString()
        };
        
        // Log the raid detection
        securityHandler.logSecurityEvent('RAID_DETECTED', logData);
        
        // Create an embed for the raid alert
        const raidAlertEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🚨 RAID ALERT')
            .setDescription(`Potential raid detected: ${joinCount} members joined in ${config.timeThreshold} seconds.`)
            .addFields(
                { name: 'Action Taken', value: action.charAt(0).toUpperCase() + action.slice(1) }
            )
            .setTimestamp();
        
        // Send to log channel if configured
        if (config.logChannel) {
            try {
                const logChannel = await guild.channels.fetch(config.logChannel);
                if (logChannel && logChannel.isTextBased()) {
                    await logChannel.send({ embeds: [raidAlertEmbed] });
                }
            } catch (err) {
                console.error('[SECURITY] Error sending to raid log channel:', err);
            }
        }
        
        // Get recent join data
        const guildJoins = recentJoins.get(guild.id);
        const recentTimeThreshold = Date.now() - (config.timeThreshold * 1000);
        const recentUsers = guildJoins
            .filter(join => join.timestamp >= recentTimeThreshold)
            .map(join => join.userId);
        
        // Take the appropriate action
        switch (action) {
            case 'lockdown':
                await performLockdown(guild, raidAlertEmbed);
                break;
                
            case 'kick':
                await performMassKick(guild, recentUsers, 'Anti-raid security measure');
                break;
                
            case 'ban':
                await performMassBan(guild, recentUsers, 'Anti-raid security measure');
                break;
                
            default:
                console.log(`[SECURITY] Unknown raid action: ${action}`);
        }
        
    } catch (error) {
        console.error('[SECURITY] Error taking anti-raid action:', error);
    }
}

/**
 * Perform a server lockdown
 * @param {Guild} guild - Discord.js Guild object
 * @param {EmbedBuilder} alertEmbed - Alert embed to send to channels
 */
async function performLockdown(guild, alertEmbed) {
    try {
        console.log(`[SECURITY] Performing lockdown in ${guild.name}`);
        
        // Get all text channels
        const textChannels = guild.channels.cache.filter(channel => 
            channel.isTextBased() && !channel.isVoiceBased() && !channel.isThread()
        );
        
        // Lock all text channels for @everyone
        const everyoneRole = guild.roles.everyone;
        
        for (const [_, channel] of textChannels) {
            try {
                await channel.permissionOverwrites.edit(everyoneRole, {
                    SendMessages: false
                }, { reason: 'Anti-raid security lockdown' });
                
                // Send alert to channel
                await channel.send({ 
                    content: '🚨 **EMERGENCY LOCKDOWN** 🚨',
                    embeds: [alertEmbed]
                });
            } catch (err) {
                console.error(`[SECURITY] Error locking channel ${channel.name}:`, err);
            }
        }
        
        console.log(`[SECURITY] Lockdown complete for ${guild.name}`);
    } catch (error) {
        console.error('[SECURITY] Error during lockdown:', error);
    }
}

/**
 * Kick multiple users as part of anti-raid measures
 * @param {Guild} guild - Discord.js Guild object
 * @param {string[]} userIds - Array of user IDs to kick
 * @param {string} reason - Reason for kicking
 */
async function performMassKick(guild, userIds, reason) {
    try {
        console.log(`[SECURITY] Mass-kicking ${userIds.length} users from ${guild.name}`);
        
        let successCount = 0;
        let failCount = 0;
        
        for (const userId of userIds) {
            try {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member && member.kickable) {
                    await member.kick(reason);
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (err) {
                console.error(`[SECURITY] Error kicking user ${userId}:`, err);
                failCount++;
            }
        }
        
        console.log(`[SECURITY] Mass-kick complete: ${successCount} successful, ${failCount} failed`);
    } catch (error) {
        console.error('[SECURITY] Error during mass-kick:', error);
    }
}

/**
 * Ban multiple users as part of anti-raid measures
 * @param {Guild} guild - Discord.js Guild object
 * @param {string[]} userIds - Array of user IDs to ban
 * @param {string} reason - Reason for banning
 */
async function performMassBan(guild, userIds, reason) {
    try {
        console.log(`[SECURITY] Mass-banning ${userIds.length} users from ${guild.name}`);
        
        let successCount = 0;
        let failCount = 0;
        
        for (const userId of userIds) {
            try {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member && member.bannable) {
                    await member.ban({ reason, deleteMessageDays: 1 });
                    successCount++;
                } else {
                    // Try to ban via guild.bans if member fetch failed
                    await guild.bans.create(userId, { reason, deleteMessageDays: 1 });
                    successCount++;
                }
            } catch (err) {
                console.error(`[SECURITY] Error banning user ${userId}:`, err);
                failCount++;
            }
        }
        
        console.log(`[SECURITY] Mass-ban complete: ${successCount} successful, ${failCount} failed`);
    } catch (error) {
        console.error('[SECURITY] Error during mass-ban:', error);
    }
}

// Initialize on module load
init();

module.exports = {
    processMemberJoin
};
