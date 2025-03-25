const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Import currency system
const currencySystem = require('./Currency');
const shopSystem = require('./shop');
const gameSystem = require('./Games');

/**
 * Initialize all utility systems
 * @param {Client} client - Discord.js client
 */
function initSystems(client) {
    console.log('[UTILS] Initializing utility systems...');
    
    // Create necessary directories
    const dataDir = path.join(__dirname, '../../data');
    const logsDir = path.join(__dirname, '../../logs');
    
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log('[UTILS] Created data directory');
    }
    
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
        console.log('[UTILS] Created logs directory');
    }
    
    // Set up message collector for shop interactions
    setupMessageCollectors(client);
    
    console.log('[UTILS] Utility systems initialized');
}

/**
 * Set up message collectors for shop interactions
 * @param {Client} client - Discord.js client
 */
function setupMessageCollectors(client) {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        
        // Check if there's an active session for this user
        // This should be expanded in a production bot with proper session management
        // For simplicity, this is a basic implementation
        
        // Handle custom role color input
        if (message.content.match(/^#[0-9A-Fa-f]{6}$/)) {
            try {
                const guild = message.guild;
                if (!guild) return;
                
                // Create a new role with the specified color
                const colorCode = message.content.toUpperCase();
                const colorInt = parseInt(colorCode.substring(1), 16);
                
                const role = await guild.roles.create({
                    name: `${message.author.username}'s Color`,
                    color: colorInt,
                    reason: 'Custom color role from shop'
                });
                
                // Assign the role to the user
                const member = await guild.members.fetch(message.author.id);
                await member.roles.add(role);
                
                await message.reply({
                    content: `✅ Created and assigned your custom color role: ${colorCode}`
                });
            } catch (error) {
                console.error('[UTILS] Error creating custom role:', error);
                await message.reply({
                    content: '❌ Failed to create custom role. Please contact an administrator.'
                });
            }
        }
        
        // Handle nickname change input
        // In a production bot, you'd want to have a more robust system to track
        // which users are in which stage of which process
    });
}

/**
 * Get all command builders for utilities
 * @returns {Array} Array of command builders
 */
function getCommandBuilders() {
    return [
        ...currencySystem.currencyCommands,
        ...shopSystem.shopCommands,
        ...gameSystem.gameCommands,
        
        // Setup command for currency system
        new SlashCommandBuilder()
            .setName('setup-economy')
            .setDescription('Set up the economy system for the server')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('Channel to use for currency commands')
                    .setRequired(true))
    ];
}

/**
 * Handle utility commands
 * @param {Client} client - Discord.js client
 * @param {Interaction} interaction - Discord.js interaction
 */
async function handleCommand(client, interaction) {
    if (!interaction.isCommand()) return;
    
    const { commandName } = interaction;
    
    // Handle currency commands
    if (commandName === 'bizz' || commandName === 'admin-bizz') {
        await currencySystem.executeCommand(interaction);
    }
    
    // Handle shop commands
    else if (commandName === 'shop' || commandName === 'admin-shop') {
        await shopSystem.executeCommand(client, interaction);
    }
    
    // Handle game commands
    else if (commandName === 'colors' || commandName === 'coinflip') {
        await gameSystem.executeCommand(interaction);
    }
    
    // Handle setup commands
    else if (commandName === 'setup-economy') {
        const channel = interaction.options.getChannel('channel');
        
        // Set currency channel
        const success = currencySystem.setCurrencyChannel(interaction.guildId, channel.id);
        
        if (success) {
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Economy System Setup')
                .setDescription(`Economy system has been set up successfully!`)
                .addFields(
                    { name: 'Currency Channel', value: `<#${channel.id}>` },
                    { name: 'Currency Name', value: 'Bizz' },
                    { name: 'Available Commands', value: '`/bizz`, `/shop`, `/colors`, `/coinflip`' }
                )
                .setTimestamp();
                
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply({
                content: '❌ Failed to set up economy system. Please try again.',
                ephemeral: true
            });
        }
    }
}

// Export all utility functions
module.exports = {
    initSystems,
    getCommandBuilders,
    handleCommand,
    
    // Re-export functions from other modules for easy access
    currency: currencySystem,
    shop: shopSystem,
    games: gameSystem
};
