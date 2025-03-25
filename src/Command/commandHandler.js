const { REST, Routes } = require('discord.js');
const { 
    kickCommand, 
    banCommand, 
    unbanCommand, 
    muteCommand, 
    unmuteCommand, 
    warnCommand, 
    unwarnCommand,
    setupCommand,
    helpCommand
} = require('./AdminCommands');
const { deafenCommand, undeafenCommand } = require('./voiceModCommands');
const { softbanCommand, purgeCommand } = require('./messageModCommands');
const { slowmodeCommand, lockCommand, unlockCommand } = require('./channelCommands');
const { addRoleCommand, removeRoleCommand, createRoleCommand } = require('./roleCommands');
const { deleteRoleCommand, roleAllCommand, revokeRoleAllCommand } = require('./roleCommands2');
const { announceCommand, pingRoleCommand, dmCommand } = require('./communicationCommands');
const fs = require('fs');
const path = require('path');
const securitySystem = require('../Security/syshandling');
require('dotenv').config();

// Collection of registered commands
const commandHandlers = {};

// Function to prepare commands for registration
function prepareCommandsForRegistration() {
    const commandsToRegister = [];
    const preparedCommands = [];
    
    // Predefined commands array
    const predefinedCommands = [
        // Admin commands
        kickCommand,
        banCommand,
        unbanCommand,
        muteCommand,
        unmuteCommand,
        warnCommand,
        unwarnCommand,
        setupCommand,
        helpCommand,
        
        // Voice moderation commands
        deafenCommand,
        undeafenCommand,
        
        // Message moderation commands
        softbanCommand,
        purgeCommand,
        
        // Channel management commands
        slowmodeCommand,
        lockCommand,
        unlockCommand,
        
        // Role management commands
        addRoleCommand,
        removeRoleCommand,
        createRoleCommand,
        deleteRoleCommand,
        roleAllCommand,
        revokeRoleAllCommand,
        
        // Communication commands
        announceCommand,
        pingRoleCommand,
        dmCommand
    ];
    
    // Process and add predefined commands
    for (const command of predefinedCommands) {
        if (command && command.data) {
            const jsonData = command.data.toJSON();
            commandsToRegister.push(jsonData);
            commandHandlers[command.data.name] = command;
            preparedCommands.push(command.data.name);
        }
    }
    
    // Add verification commands
    const verificationCommands = securitySystem.getVerificationCommands();
    if (verificationCommands && verificationCommands.length > 0) {
        for (const command of verificationCommands) {
            const jsonData = command.toJSON();
            commandsToRegister.push(jsonData);
            preparedCommands.push(jsonData.name);
        }
    }
    
    // Log all commands in a single line instead of individually
    console.log(`[COMMAND] Prepared ${preparedCommands.length} commands: ${preparedCommands.join(', ')}`);
    
    return commandsToRegister;
}

// Function to clear all existing commands
async function clearCommands(clientId, guildId = process.env.GUILD_ID) {
    try {
        console.log('Started clearing old application (/) commands.');
        
        if (!process.env.TOKEN) {
            throw new Error('Bot token is missing in environment variables');
        }
        
        if (!clientId) {
            throw new Error('Client ID is undefined or null');
        }
        
        console.log(`Using client ID: ${clientId} for command clearing`);
        
        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        
        if (guildId) {
            console.log(`[COMMAND] Clearing all commands from test guild ${guildId}`);
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
            console.log('[COMMAND] Successfully cleared all commands from test guild.');
        } else {
            console.log('[COMMAND] Clearing all global commands');
            await rest.put(Routes.applicationCommands(clientId), { body: [] });
            console.log('[COMMAND] Successfully cleared all global commands.');
        }
        
        return true;
    } catch (error) {
        console.error('Error clearing commands:', error);
        throw error;
    }
}

// Function to register slash commands
async function registerCommands(clientId, additionalCommands = [], guildId = process.env.GUILD_ID) {
    try {
        const commandsToRegister = prepareCommandsForRegistration();
        
        // Add any additional commands if provided
        if (additionalCommands && additionalCommands.length > 0) {
            for (const command of additionalCommands) {
                if (command) {
                    const jsonData = command.toJSON();
                    commandsToRegister.push(jsonData);
                    console.log(`[COMMAND] Added additional command: ${jsonData.name}`);
                }
            }
        }
        
        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        
        console.log(`[COMMAND] Started refreshing ${commandsToRegister.length} application commands.`);
        console.log('[COMMAND] This may take a few minutes...');

        // Find music command to register globally
        const musicCommands = commandsToRegister.filter(cmd => cmd.name === 'music');
        const otherCommands = commandsToRegister.filter(cmd => cmd.name !== 'music');
        
        // Register music command globally
        if (musicCommands.length > 0) {
            console.log('[COMMAND] Registering music command globally');
            try {
                // Register the music command globally
                const musicData = await rest.put(
                    Routes.applicationCommands(clientId),
                    { body: musicCommands }
                );
                console.log(`[COMMAND] Successfully registered music command globally.`);
            } catch (error) {
                console.error(`[ERROR] Failed to register music command globally: ${error.message}`);
            }
        }
        
        let data;
        
        // If we have a guild ID, register other commands to the test guild for instant updates
        if (guildId) {
            console.log(`[COMMAND] Registering other commands to guild ${guildId}`);
            try {
                // First clear existing commands to ensure a clean slate
                await rest.put(
                    Routes.applicationGuildCommands(clientId, guildId),
                    { body: [] }
                );
                console.log(`[COMMAND] Cleared existing commands from guild ${guildId}`);
                
                // Then register the new commands
                data = await rest.put(
                    Routes.applicationGuildCommands(clientId, guildId),
                    { body: otherCommands }
                );
                
                console.log(`[COMMAND] Successfully registered ${data.length} application commands to guild ${guildId}.`);
                console.log(`[COMMAND] Command names: ${data.map(cmd => cmd.name).join(', ')}`);
                return { guildData: data };
            } catch (error) {
                console.error(`[ERROR] Failed to register commands to guild: ${error.message}`);
                console.error(error);
                // Try global registration as fallback
                console.log('[COMMAND] Attempting global registration as fallback...');
            }
        }
        
        // Register other commands globally (takes up to an hour to update)
        console.log('[COMMAND] Registering other commands globally');
        // First clear existing commands
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: [] }
        );
        console.log('[COMMAND] Cleared existing global commands');
        
        // Then register the new commands
        data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: otherCommands }
        );
        
        console.log(`[COMMAND] Successfully registered ${data.length} application commands globally.`);
        console.log(`[COMMAND] Command names: ${data.map(cmd => cmd.name).join(', ')}`);
        return { globalData: data };
    } catch (error) {
        console.error(`[ERROR] Error registering commands: ${error.message}`);
        if (error.code) {
            console.error(`[ERROR] Discord API Error Code: ${error.code}`);
        }
        if (error.method && error.path) {
            console.error(`[ERROR] Request details: ${error.method} ${error.path}`);
        }
        if (error.requestBody) {
            console.error(`[ERROR] Request body: ${JSON.stringify(error.requestBody)}`);
        }
        console.log('[COMMAND] Bot will continue starting up, but commands may not be available');
        return { error: error.message };
    }
}

// Function to handle command interactions
async function handleCommandInteraction(interaction) {
    try {
        const { commandName } = interaction;
        
        // First check if this is a verification command
        const handled = await securitySystem.executeVerificationCommand(interaction);
        if (handled) {
            return;
        }
        
        // Otherwise look for a regular command handler
        const command = commandHandlers[commandName];
        
        if (!command) {
            return interaction.reply({ content: 'This command is not implemented yet.', ephemeral: true });
        }
        
        await command.execute(interaction);
    } catch (error) {
        console.error(`[ERROR] Error executing command ${interaction.commandName}:`, error);
        try {
            const errorMessage = 'There was an error executing this command.';
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        } catch (e) {
            console.error('[ERROR] Could not send error message:', e);
        }
    }
}

module.exports = {
    clearCommands,
    registerCommands,
    handleCommandInteraction
}; 