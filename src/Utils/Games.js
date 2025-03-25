const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getUserBalance, addCurrency, removeCurrency } = require('./Currency');

// Define path for games data
const DATA_DIR = path.join(__dirname, '../../data');
const GAMES_FILE = path.join(DATA_DIR, 'games.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load games data
function loadGamesData() {
    try {
        if (fs.existsSync(GAMES_FILE)) {
            const data = fs.readFileSync(GAMES_FILE, 'utf8');
            return JSON.parse(data);
        } else {
            // Initial structure for games data
            const initialData = {
                colorTrades: {},
                coinFlips: {},
                lastUpdated: new Date().toISOString()
            };
            saveGamesData(initialData);
            return initialData;
        }
    } catch (error) {
        console.error('[GAMES] Error loading games data:', error);
        return { colorTrades: {}, coinFlips: {}, lastUpdated: new Date().toISOString() };
    }
}

// Save games data
function saveGamesData(data) {
    try {
        data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(GAMES_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('[GAMES] Error saving games data:', error);
        return false;
    }
}

/************************
 * COLOR TRADING GAME
 ************************/

// Available colors for the color trading game
const availableColors = [
    { name: 'Red', value: 'red', color: 0xFF0000, emoji: '🔴', rarity: 'common', baseValue: 50 },
    { name: 'Blue', value: 'blue', color: 0x0000FF, emoji: '🔵', rarity: 'common', baseValue: 50 },
    { name: 'Green', value: 'green', color: 0x00FF00, emoji: '🟢', rarity: 'common', baseValue: 50 },
    { name: 'Yellow', value: 'yellow', color: 0xFFFF00, emoji: '🟡', rarity: 'common', baseValue: 50 },
    { name: 'Purple', value: 'purple', color: 0x800080, emoji: '🟣', rarity: 'uncommon', baseValue: 100 },
    { name: 'Orange', value: 'orange', color: 0xFFA500, emoji: '🟠', rarity: 'uncommon', baseValue: 100 },
    { name: 'Pink', value: 'pink', color: 0xFFC0CB, emoji: '💗', rarity: 'uncommon', baseValue: 100 },
    { name: 'Black', value: 'black', color: 0x000000, emoji: '⚫', rarity: 'rare', baseValue: 200 },
    { name: 'White', value: 'white', color: 0xFFFFFF, emoji: '⚪', rarity: 'rare', baseValue: 200 },
    { name: 'Gold', value: 'gold', color: 0xFFD700, emoji: '🟨', rarity: 'epic', baseValue: 500 },
    { name: 'Silver', value: 'silver', color: 0xC0C0C0, emoji: '⬜', rarity: 'epic', baseValue: 500 },
    { name: 'Rainbow', value: 'rainbow', color: 0xFFADC6, emoji: '🌈', rarity: 'legendary', baseValue: 1000 }
];

// Calculate color rarity percentages
const rarityChances = {
    common: 60,
    uncommon: 25,
    rare: 10,
    epic: 4,
    legendary: 1
};

// Get a random color based on rarity chances
function getRandomColor() {
    const randNum = Math.random() * 100;
    let rarityTier;
    
    if (randNum < rarityChances.legendary) {
        rarityTier = 'legendary';
    } else if (randNum < rarityChances.legendary + rarityChances.epic) {
        rarityTier = 'epic';
    } else if (randNum < rarityChances.legendary + rarityChances.epic + rarityChances.rare) {
        rarityTier = 'rare';
    } else if (randNum < rarityChances.legendary + rarityChances.epic + rarityChances.rare + rarityChances.uncommon) {
        rarityTier = 'uncommon';
    } else {
        rarityTier = 'common';
    }
    
    // Filter colors by rarity and pick a random one
    const colorsOfRarity = availableColors.filter(color => color.rarity === rarityTier);
    const randomIndex = Math.floor(Math.random() * colorsOfRarity.length);
    
    return colorsOfRarity[randomIndex];
}

// Get user's color inventory
function getUserColors(userId) {
    const data = loadGamesData();
    
    if (!data.colorTrades[userId]) {
        data.colorTrades[userId] = {
            colors: {},
            lastHunt: null
        };
        saveGamesData(data);
    }
    
    return data.colorTrades[userId].colors;
}

// Add color to user inventory
function addColorToUser(userId, colorValue, quantity = 1) {
    const data = loadGamesData();
    
    if (!data.colorTrades[userId]) {
        data.colorTrades[userId] = {
            colors: {},
            lastHunt: null
        };
    }
    
    if (!data.colorTrades[userId].colors[colorValue]) {
        data.colorTrades[userId].colors[colorValue] = 0;
    }
    
    data.colorTrades[userId].colors[colorValue] += quantity;
    
    saveGamesData(data);
}

// Remove color from user inventory
function removeColorFromUser(userId, colorValue, quantity = 1) {
    const data = loadGamesData();
    
    if (!data.colorTrades[userId] || 
        !data.colorTrades[userId].colors[colorValue] || 
        data.colorTrades[userId].colors[colorValue] < quantity) {
        return false;
    }
    
    data.colorTrades[userId].colors[colorValue] -= quantity;
    
    // Remove color entry if quantity is 0
    if (data.colorTrades[userId].colors[colorValue] === 0) {
        delete data.colorTrades[userId].colors[colorValue];
    }
    
    saveGamesData(data);
    return true;
}

// Hunt for a random color
function huntColor(userId) {
    const data = loadGamesData();
    
    if (!data.colorTrades[userId]) {
        data.colorTrades[userId] = {
            colors: {},
            lastHunt: null
        };
    }
    
    const now = new Date();
    const lastHunt = data.colorTrades[userId].lastHunt ? new Date(data.colorTrades[userId].lastHunt) : null;
    
    // Check if user can hunt (cooldown of 1 hour)
    if (lastHunt) {
        const cooldownTime = new Date(lastHunt.getTime() + 60 * 60 * 1000); // 1 hour cooldown
        
        if (now < cooldownTime) {
            // Calculate time until cooldown ends
            const timeUntilCooldown = cooldownTime - now;
            const minutesUntilCooldown = Math.ceil(timeUntilCooldown / (1000 * 60));
            
            return {
                success: false,
                cooldown: minutesUntilCooldown,
                message: `You need to wait ${minutesUntilCooldown} minutes before hunting again.`
            };
        }
    }
    
    // Get a random color
    const randomColor = getRandomColor();
    
    // Add color to user inventory
    addColorToUser(userId, randomColor.value);
    
    // Update last hunt time
    data.colorTrades[userId].lastHunt = now.toISOString();
    saveGamesData(data);
    
    return {
        success: true,
        color: randomColor,
        message: `You found a ${randomColor.emoji} **${randomColor.name}** color (${randomColor.rarity})!`
    };
}

// Sell a color for Bizz
function sellColor(userId, colorValue, quantity = 1) {
    // Check if user has the color
    const colors = getUserColors(userId);
    if (!colors[colorValue] || colors[colorValue] < quantity) {
        return {
            success: false,
            message: `You don't have enough of this color to sell.`
        };
    }
    
    // Find color details
    const colorDetails = availableColors.find(c => c.value === colorValue);
    if (!colorDetails) {
        return {
            success: false,
            message: 'Invalid color.'
        };
    }
    
    // Calculate sell value with random fluctuation (±10%)
    const baseValue = colorDetails.baseValue * quantity;
    const fluctuation = Math.random() * 0.2 - 0.1; // -10% to +10%
    const sellValue = Math.round(baseValue * (1 + fluctuation));
    
    // Remove color from inventory
    const removed = removeColorFromUser(userId, colorValue, quantity);
    if (!removed) {
        return {
            success: false,
            message: `Failed to sell color. Please try again.`
        };
    }
    
    // Add currency to user
    const currencyAdded = addCurrency(userId, sellValue, `Sold ${quantity} ${colorDetails.name} color(s)`);
    if (!currencyAdded) {
        // Revert color removal if currency wasn't added
        addColorToUser(userId, colorValue, quantity);
        return {
            success: false,
            message: `Failed to add currency. Please try again.`
        };
    }
    
    return {
        success: true,
        color: colorDetails,
        quantity: quantity,
        value: sellValue,
        message: `You sold ${quantity} ${colorDetails.emoji} ${colorDetails.name} color(s) for ${sellValue} Bizz.`
    };
}

/************************
 * COIN FLIP GAME
 ************************/

// Flip a coin game
function playCoinFlip(userId, bet, choice) {
    // Validate parameters
    if (bet < 10) {
        return {
            success: false,
            message: 'Minimum bet is 10 Bizz.'
        };
    }
    
    if (choice !== 'heads' && choice !== 'tails') {
        return {
            success: false,
            message: 'Choice must be heads or tails.'
        };
    }
    
    // Check if user has enough currency
    const balance = getUserBalance(userId);
    if (balance < bet) {
        return {
            success: false,
            message: `You don't have enough Bizz. You have ${balance} Bizz.`
        };
    }
    
    // Remove bet amount
    const currencyRemoved = removeCurrency(userId, bet, 'Coin flip bet');
    if (!currencyRemoved) {
        return {
            success: false,
            message: 'Failed to place bet. Please try again.'
        };
    }
    
    // Flip the coin
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = result === choice;
    
    // Calculate winnings
    const winnings = won ? bet * 2 : 0;
    
    // Add winnings if player won
    if (won) {
        addCurrency(userId, winnings, 'Coin flip win');
    }
    
    // Record game
    const data = loadGamesData();
    if (!data.coinFlips[userId]) {
        data.coinFlips[userId] = {
            totalGames: 0,
            wins: 0,
            losses: 0,
            totalBet: 0,
            totalWon: 0
        };
    }
    
    data.coinFlips[userId].totalGames += 1;
    if (won) {
        data.coinFlips[userId].wins += 1;
        data.coinFlips[userId].totalWon += winnings;
    } else {
        data.coinFlips[userId].losses += 1;
    }
    data.coinFlips[userId].totalBet += bet;
    
    saveGamesData(data);
    
    return {
        success: true,
        won: won,
        result: result,
        choice: choice,
        bet: bet,
        winnings: winnings,
        message: won 
            ? `The coin landed on ${result}! You won ${winnings} Bizz!` 
            : `The coin landed on ${result}! You lost ${bet} Bizz.`
    };
}

// Get coin flip stats for a user
function getCoinFlipStats(userId) {
    const data = loadGamesData();
    
    if (!data.coinFlips[userId]) {
        return {
            totalGames: 0,
            wins: 0,
            losses: 0,
            totalBet: 0,
            totalWon: 0,
            winRate: 0
        };
    }
    
    const stats = data.coinFlips[userId];
    stats.winRate = stats.totalGames > 0 ? (stats.wins / stats.totalGames * 100).toFixed(2) : 0;
    
    return stats;
}

// Define slash commands for games
const gameCommands = [
    new SlashCommandBuilder()
        .setName('colors')
        .setDescription('Play the color trading game')
        .addSubcommand(subcommand =>
            subcommand.setName('hunt')
                .setDescription('Hunt for a random color'))
        .addSubcommand(subcommand =>
            subcommand.setName('inventory')
                .setDescription('View your color inventory'))
        .addSubcommand(subcommand =>
            subcommand.setName('sell')
                .setDescription('Sell colors for Bizz')
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('The color to sell')
                        .setRequired(true)
                        .addChoices(...availableColors.map(c => ({ name: `${c.emoji} ${c.name}`, value: c.value }))))
                .addIntegerOption(option =>
                    option.setName('quantity')
                        .setDescription('Quantity to sell')
                        .setRequired(true)
                        .setMinValue(1))),
    
    new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin and bet on the outcome')
        .addIntegerOption(option =>
            option.setName('bet')
                .setDescription('Amount of Bizz to bet')
                .setRequired(true)
                .setMinValue(10))
        .addStringOption(option =>
            option.setName('choice')
                .setDescription('Heads or tails')
                .setRequired(true)
                .addChoices(
                    { name: 'Heads', value: 'heads' },
                    { name: 'Tails', value: 'tails' }
                ))
];

// Handle game command execution
async function executeCommand(interaction) {
    const { commandName, options, user } = interaction;
    
    if (commandName === 'colors') {
        const subcommand = options.getSubcommand();
        
        if (subcommand === 'hunt') {
            const result = huntColor(user.id);
            
            if (result.success) {
                const embed = new EmbedBuilder()
                    .setColor(result.color.color)
                    .setTitle('🎨 Color Hunt')
                    .setDescription(result.message)
                    .addFields({ name: 'Rarity', value: result.color.rarity.charAt(0).toUpperCase() + result.color.rarity.slice(1) })
                    .setFooter({ text: 'Colors can be sold for Bizz. Rarer colors are worth more!' })
                    .setTimestamp();
                    
                return interaction.reply({ embeds: [embed] });
            } else {
                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('⏱️ On Cooldown')
                    .setDescription(result.message)
                    .setFooter({ text: 'Try again later!' })
                    .setTimestamp();
                    
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
        
        else if (subcommand === 'inventory') {
            const colors = getUserColors(user.id);
            const colorKeys = Object.keys(colors);
            
            if (colorKeys.length === 0) {
                return interaction.reply({
                    content: 'You don\'t have any colors yet. Use `/colors hunt` to find some!',
                    ephemeral: true
                });
            }
            
            // Create inventory embed
            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('🎨 Your Color Inventory')
                .setThumbnail(user.displayAvatarURL())
                .setFooter({ text: 'Use /colors sell to convert colors to Bizz' })
                .setTimestamp();
                
            // Group colors by rarity
            const colorsByRarity = {
                common: [],
                uncommon: [],
                rare: [],
                epic: [],
                legendary: []
            };
            
            colorKeys.forEach(colorKey => {
                const colorInfo = availableColors.find(c => c.value === colorKey);
                if (colorInfo) {
                    colorsByRarity[colorInfo.rarity].push({
                        ...colorInfo,
                        quantity: colors[colorKey]
                    });
                }
            });
            
            // Add fields for each rarity tier (if they have colors of that tier)
            Object.entries(colorsByRarity).forEach(([rarity, colorList]) => {
                if (colorList.length > 0) {
                    const rarityTitle = rarity.charAt(0).toUpperCase() + rarity.slice(1);
                    let colorText = '';
                    
                    colorList.forEach(color => {
                        colorText += `${color.emoji} **${color.name}**: ${color.quantity} (${color.baseValue} Bizz base value)\n`;
                    });
                    
                    embed.addFields({ name: `${rarityTitle} Colors`, value: colorText });
                }
            });
            
            return interaction.reply({ embeds: [embed] });
        }
        
        else if (subcommand === 'sell') {
            const colorValue = options.getString('color');
            const quantity = options.getInteger('quantity');
            
            const result = sellColor(user.id, colorValue, quantity);
            
            if (result.success) {
                const embed = new EmbedBuilder()
                    .setColor(result.color.color)
                    .setTitle('💰 Color Sold')
                    .setDescription(result.message)
                    .setFooter({ text: 'The market value of colors fluctuates over time' })
                    .setTimestamp();
                    
                return interaction.reply({ embeds: [embed] });
            } else {
                return interaction.reply({
                    content: result.message,
                    ephemeral: true
                });
            }
        }
    }
    
    else if (commandName === 'coinflip') {
        const bet = options.getInteger('bet');
        const choice = options.getString('choice');
        
        const result = playCoinFlip(user.id, bet, choice);
        
        if (result.success) {
            const embed = new EmbedBuilder()
                .setColor(result.won ? 0x00FF00 : 0xFF0000)
                .setTitle(`🪙 Coin Flip - ${result.result.toUpperCase()}`)
                .setDescription(result.message)
                .addFields(
                    { name: 'Your Choice', value: result.choice.charAt(0).toUpperCase() + result.choice.slice(1), inline: true },
                    { name: 'Result', value: result.result.charAt(0).toUpperCase() + result.result.slice(1), inline: true },
                    { name: result.won ? 'Won' : 'Lost', value: result.won ? `${result.winnings} Bizz` : `${result.bet} Bizz`, inline: true }
                )
                .setFooter({ text: 'Your new balance: ' + getUserBalance(user.id) + ' Bizz' })
                .setTimestamp();
                
            // Get stats
            const stats = getCoinFlipStats(user.id);
            embed.addFields(
                { name: 'Your Stats', value: `Games: ${stats.totalGames} | Win Rate: ${stats.winRate}%` }
            );
                
            return interaction.reply({ embeds: [embed] });
        } else {
            return interaction.reply({
                content: result.message,
                ephemeral: true
            });
        }
    }
}

// Export functions and commands
module.exports = {
    gameCommands,
    executeCommand,
    huntColor,
    getUserColors,
    sellColor,
    playCoinFlip,
    getCoinFlipStats
};
