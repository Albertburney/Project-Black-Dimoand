const fs = require('fs');
const path = require('path');
const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

// Define path for currency data
const DATA_DIR = path.join(__dirname, '../../data');
const CURRENCY_FILE = path.join(DATA_DIR, 'currency.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load currency data
function loadCurrencyData() {
    try {
        if (fs.existsSync(CURRENCY_FILE)) {
            const data = fs.readFileSync(CURRENCY_FILE, 'utf8');
            return JSON.parse(data);
        } else {
            // Initial structure for currency data
            const initialData = {
                users: {},
                serverConfig: {},
                leaderboard: {},
                lastUpdated: new Date().toISOString()
            };
            saveCurrencyData(initialData);
            return initialData;
        }
    } catch (error) {
        console.error('[CURRENCY] Error loading currency data:', error);
        return { users: {}, serverConfig: {}, leaderboard: {}, lastUpdated: new Date().toISOString() };
    }
}

// Save currency data
function saveCurrencyData(data) {
    try {
        data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(CURRENCY_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('[CURRENCY] Error saving currency data:', error);
        return false;
    }
}

// Get user balance
function getUserBalance(userId) {
    const data = loadCurrencyData();
    if (!data.users[userId]) {
        data.users[userId] = {
            balance: 0,
            lastDaily: null,
            inventory: [],
            transactions: []
        };
        saveCurrencyData(data);
    }
    return data.users[userId].balance;
}

// Add currency to user
function addCurrency(userId, amount, reason = 'System transaction') {
    if (amount <= 0) return false;
    
    const data = loadCurrencyData();
    
    // Initialize user if not exists
    if (!data.users[userId]) {
        data.users[userId] = {
            balance: 0,
            lastDaily: null,
            inventory: [],
            transactions: []
        };
    }
    
    // Update balance
    data.users[userId].balance += amount;
    
    // Record transaction
    data.users[userId].transactions.push({
        type: 'credit',
        amount: amount,
        reason: reason,
        timestamp: new Date().toISOString()
    });
    
    // Limit transaction history to last 20
    if (data.users[userId].transactions.length > 20) {
        data.users[userId].transactions = data.users[userId].transactions.slice(-20);
    }
    
    // Update leaderboard
    updateLeaderboard(data, userId);
    
    // Save data
    return saveCurrencyData(data);
}

// Remove currency from user
function removeCurrency(userId, amount, reason = 'System transaction') {
    if (amount <= 0) return false;
    
    const data = loadCurrencyData();
    
    // Initialize user if not exists
    if (!data.users[userId]) {
        data.users[userId] = {
            balance: 0,
            lastDaily: null,
            inventory: [],
            transactions: []
        };
    }
    
    // Check if user has enough currency
    if (data.users[userId].balance < amount) {
        return false;
    }
    
    // Update balance
    data.users[userId].balance -= amount;
    
    // Record transaction
    data.users[userId].transactions.push({
        type: 'debit',
        amount: amount,
        reason: reason,
        timestamp: new Date().toISOString()
    });
    
    // Limit transaction history to last 20
    if (data.users[userId].transactions.length > 20) {
        data.users[userId].transactions = data.users[userId].transactions.slice(-20);
    }
    
    // Update leaderboard
    updateLeaderboard(data, userId);
    
    // Save data
    return saveCurrencyData(data);
}

// Transfer currency between users
function transferCurrency(fromUserId, toUserId, amount, reason = 'User transfer') {
    if (amount <= 0 || fromUserId === toUserId) return false;
    
    const data = loadCurrencyData();
    
    // Initialize users if not exists
    if (!data.users[fromUserId]) {
        data.users[fromUserId] = {
            balance: 0,
            lastDaily: null,
            inventory: [],
            transactions: []
        };
    }
    
    if (!data.users[toUserId]) {
        data.users[toUserId] = {
            balance: 0,
            lastDaily: null,
            inventory: [],
            transactions: []
        };
    }
    
    // Check if sender has enough currency
    if (data.users[fromUserId].balance < amount) {
        return false;
    }
    
    // Update balances
    data.users[fromUserId].balance -= amount;
    data.users[toUserId].balance += amount;
    
    // Record transactions
    const timestamp = new Date().toISOString();
    
    data.users[fromUserId].transactions.push({
        type: 'debit',
        amount: amount,
        reason: `Transfer to <@${toUserId}>: ${reason}`,
        timestamp: timestamp
    });
    
    data.users[toUserId].transactions.push({
        type: 'credit',
        amount: amount,
        reason: `Transfer from <@${fromUserId}>: ${reason}`,
        timestamp: timestamp
    });
    
    // Limit transaction history to last 20
    if (data.users[fromUserId].transactions.length > 20) {
        data.users[fromUserId].transactions = data.users[fromUserId].transactions.slice(-20);
    }
    
    if (data.users[toUserId].transactions.length > 20) {
        data.users[toUserId].transactions = data.users[toUserId].transactions.slice(-20);
    }
    
    // Update leaderboard
    updateLeaderboard(data, fromUserId);
    updateLeaderboard(data, toUserId);
    
    // Save data
    return saveCurrencyData(data);
}

// Update leaderboard entry for a user
function updateLeaderboard(data, userId) {
    if (!data.leaderboard) {
        data.leaderboard = {};
    }
    
    data.leaderboard[userId] = {
        balance: data.users[userId].balance,
        lastUpdated: new Date().toISOString()
    };
}

// Get top 10 richest users
function getLeaderboard() {
    const data = loadCurrencyData();
    
    if (!data.leaderboard) {
        data.leaderboard = {};
    }
    
    // Convert to array and sort by balance
    const leaderboardArray = Object.entries(data.leaderboard)
        .map(([userId, info]) => ({
            userId,
            balance: info.balance
        }))
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 10); // Get top 10
    
    return leaderboardArray;
}

// Claim daily reward
function claimDaily(userId) {
    const data = loadCurrencyData();
    
    // Initialize user if not exists
    if (!data.users[userId]) {
        data.users[userId] = {
            balance: 0,
            lastDaily: null,
            inventory: [],
            transactions: []
        };
    }
    
    const now = new Date();
    const lastDaily = data.users[userId].lastDaily ? new Date(data.users[userId].lastDaily) : null;
    
    // Check if user can claim daily
    if (lastDaily) {
        // Reset at midnight
        const resetTime = new Date(lastDaily);
        resetTime.setHours(24, 0, 0, 0);
        
        if (now < resetTime) {
            // Calculate time until reset
            const timeUntilReset = resetTime - now;
            const hoursUntilReset = Math.floor(timeUntilReset / (1000 * 60 * 60));
            const minutesUntilReset = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));
            
            return {
                success: false,
                timeUntilReset: `${hoursUntilReset}h ${minutesUntilReset}m`,
                resetTime: resetTime.toISOString()
            };
        }
    }
    
    // Calculate daily reward (random between 100 and 500)
    const amount = Math.floor(Math.random() * 401) + 100;
    
    // Update balance
    data.users[userId].balance += amount;
    data.users[userId].lastDaily = now.toISOString();
    
    // Record transaction
    data.users[userId].transactions.push({
        type: 'credit',
        amount: amount,
        reason: 'Daily reward',
        timestamp: now.toISOString()
    });
    
    // Limit transaction history to last 20
    if (data.users[userId].transactions.length > 20) {
        data.users[userId].transactions = data.users[userId].transactions.slice(-20);
    }
    
    // Update leaderboard
    updateLeaderboard(data, userId);
    
    // Save data
    saveCurrencyData(data);
    
    return {
        success: true,
        amount: amount
    };
}

// Check if channel is allowed for currency commands
function isAllowedChannel(guildId, channelId) {
    const data = loadCurrencyData();
    
    if (!data.serverConfig[guildId] || !data.serverConfig[guildId].currencyChannel) {
        // If no channel is specified, allow all channels
        return true;
    }
    
    return data.serverConfig[guildId].currencyChannel === channelId;
}

// Set currency channel for a server
function setCurrencyChannel(guildId, channelId) {
    const data = loadCurrencyData();
    
    if (!data.serverConfig[guildId]) {
        data.serverConfig[guildId] = {};
    }
    
    data.serverConfig[guildId].currencyChannel = channelId;
    data.serverConfig[guildId].currencyName = "Bizz"; // Default currency name
    
    return saveCurrencyData(data);
}

// Define slash commands for currency system
const currencyCommands = [
    new SlashCommandBuilder()
        .setName('bizz')
        .setDescription('Check your Bizz balance or claim daily rewards')
        .addSubcommand(subcommand =>
            subcommand.setName('balance')
                .setDescription('Check your current Bizz balance'))
        .addSubcommand(subcommand =>
            subcommand.setName('daily')
                .setDescription('Claim your daily Bizz reward'))
        .addSubcommand(subcommand =>
            subcommand.setName('leaderboard')
                .setDescription('View the richest users'))
        .addSubcommand(subcommand =>
            subcommand.setName('pay')
                .setDescription('Transfer Bizz to another user')
                .addUserOption(option => 
                    option.setName('user')
                        .setDescription('User to pay')
                        .setRequired(true))
                .addIntegerOption(option => 
                    option.setName('amount')
                        .setDescription('Amount to transfer')
                        .setRequired(true)
                        .setMinValue(1))),
    
    new SlashCommandBuilder()
        .setName('admin-bizz')
        .setDescription('Admin commands for Bizz currency')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName('give')
                .setDescription('Give Bizz to a user')
                .addUserOption(option => 
                    option.setName('user')
                        .setDescription('User to give Bizz to')
                        .setRequired(true))
                .addIntegerOption(option => 
                    option.setName('amount')
                        .setDescription('Amount to give')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand.setName('take')
                .setDescription('Take Bizz from a user')
                .addUserOption(option => 
                    option.setName('user')
                        .setDescription('User to take Bizz from')
                        .setRequired(true))
                .addIntegerOption(option => 
                    option.setName('amount')
                        .setDescription('Amount to take')
                        .setRequired(true)
                        .setMinValue(1))),
];

// Handle currency command execution
async function executeCommand(interaction) {
    const { commandName, options, user, channelId, guildId } = interaction;
    
    // If not in allowed channel, reject the command
    if (!isAllowedChannel(guildId, channelId)) {
        const data = loadCurrencyData();
        const allowedChannelId = data.serverConfig[guildId]?.currencyChannel;
        if (allowedChannelId) {
            return interaction.reply({
                content: `❌ Currency commands can only be used in <#${allowedChannelId}>`,
                ephemeral: true
            });
        }
    }
    
    // Handle regular user commands
    if (commandName === 'bizz') {
        const subcommand = options.getSubcommand();
        
        if (subcommand === 'balance') {
            const balance = getUserBalance(user.id);
            
            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('💰 Bizz Balance')
                .setDescription(`You have **${balance.toLocaleString()} Bizz**`)
                .setThumbnail(user.displayAvatarURL())
                .setFooter({ text: 'Use /bizz daily to get your daily reward!' })
                .setTimestamp();
                
            return interaction.reply({ embeds: [embed] });
        }
        
        else if (subcommand === 'daily') {
            const result = claimDaily(user.id);
            
            if (result.success) {
                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🎁 Daily Reward Claimed!')
                    .setDescription(`You received **${result.amount} Bizz**!\nYou now have **${getUserBalance(user.id).toLocaleString()} Bizz**`)
                    .setThumbnail(user.displayAvatarURL())
                    .setFooter({ text: 'Come back tomorrow for another reward!' })
                    .setTimestamp();
                    
                return interaction.reply({ embeds: [embed] });
            } else {
                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Daily Reward Already Claimed')
                    .setDescription(`You already claimed your daily reward.\nCome back in **${result.timeUntilReset}**`)
                    .setThumbnail(user.displayAvatarURL())
                    .setFooter({ text: 'Try again later!' })
                    .setTimestamp();
                    
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
        
        else if (subcommand === 'leaderboard') {
            const leaderboard = getLeaderboard();
            
            if (leaderboard.length === 0) {
                return interaction.reply({
                    content: 'No one has earned any Bizz yet!',
                    ephemeral: true
                });
            }
            
            // Create leaderboard embed
            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('💰 Bizz Leaderboard')
                .setDescription('The richest users in the server')
                .setTimestamp();
                
            // Add each user to the leaderboard
            let leaderboardText = '';
            for (let i = 0; i < leaderboard.length; i++) {
                const entry = leaderboard[i];
                leaderboardText += `**${i + 1}.** <@${entry.userId}>: ${entry.balance.toLocaleString()} Bizz\n`;
            }
            
            embed.setDescription(leaderboardText);
            
            return interaction.reply({ embeds: [embed] });
        }
        
        else if (subcommand === 'pay') {
            const targetUser = options.getUser('user');
            const amount = options.getInteger('amount');
            
            // Check if target is self
            if (targetUser.id === user.id) {
                return interaction.reply({
                    content: '❌ You cannot pay yourself!',
                    ephemeral: true
                });
            }
            
            // Check if target is a bot
            if (targetUser.bot) {
                return interaction.reply({
                    content: '❌ You cannot pay bots!',
                    ephemeral: true
                });
            }
            
            // Get user balance
            const balance = getUserBalance(user.id);
            
            // Check if user has enough funds
            if (balance < amount) {
                return interaction.reply({
                    content: `❌ You don't have enough Bizz. You have ${balance.toLocaleString()} Bizz.`,
                    ephemeral: true
                });
            }
            
            // Transfer currency
            const success = transferCurrency(user.id, targetUser.id, amount, 'User payment');
            
            if (success) {
                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('💸 Payment Sent')
                    .setDescription(`You sent **${amount.toLocaleString()} Bizz** to ${targetUser}.\nYou now have **${getUserBalance(user.id).toLocaleString()} Bizz**`)
                    .setThumbnail(user.displayAvatarURL())
                    .setTimestamp();
                    
                return interaction.reply({ embeds: [embed] });
            } else {
                return interaction.reply({
                    content: '❌ Failed to send payment. Please try again later.',
                    ephemeral: true
                });
            }
        }
    }
    
    // Handle admin commands
    else if (commandName === 'admin-bizz') {
        const subcommand = options.getSubcommand();
        
        if (subcommand === 'give') {
            const targetUser = options.getUser('user');
            const amount = options.getInteger('amount');
            
            // Add currency to user
            const success = addCurrency(targetUser.id, amount, 'Admin award');
            
            if (success) {
                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('💰 Admin: Bizz Added')
                    .setDescription(`Added **${amount.toLocaleString()} Bizz** to ${targetUser}.\nThey now have **${getUserBalance(targetUser.id).toLocaleString()} Bizz**`)
                    .setTimestamp();
                    
                return interaction.reply({ embeds: [embed] });
            } else {
                return interaction.reply({
                    content: '❌ Failed to add Bizz. Please try again later.',
                    ephemeral: true
                });
            }
        }
        
        else if (subcommand === 'take') {
            const targetUser = options.getUser('user');
            const amount = options.getInteger('amount');
            
            // Get target user balance
            const balance = getUserBalance(targetUser.id);
            
            // Check if target has enough funds
            if (balance < amount) {
                return interaction.reply({
                    content: `❌ ${targetUser} doesn't have enough Bizz. They have ${balance.toLocaleString()} Bizz.`,
                    ephemeral: true
                });
            }
            
            // Remove currency from user
            const success = removeCurrency(targetUser.id, amount, 'Admin removal');
            
            if (success) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('💰 Admin: Bizz Removed')
                    .setDescription(`Removed **${amount.toLocaleString()} Bizz** from ${targetUser}.\nThey now have **${getUserBalance(targetUser.id).toLocaleString()} Bizz**`)
                    .setTimestamp();
                    
                return interaction.reply({ embeds: [embed] });
            } else {
                return interaction.reply({
                    content: '❌ Failed to remove Bizz. Please try again later.',
                    ephemeral: true
                });
            }
        }
    }
}

// Export functions and commands
module.exports = {
    currencyCommands,
    executeCommand,
    getUserBalance,
    addCurrency,
    removeCurrency,
    transferCurrency,
    claimDaily,
    getLeaderboard,
    setCurrencyChannel,
    isAllowedChannel
};
