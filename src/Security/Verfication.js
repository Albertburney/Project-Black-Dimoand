const { 
    EmbedBuilder, 
    ButtonBuilder, 
    ActionRowBuilder, 
    ButtonStyle, 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createCanvas, loadImage } = require('canvas');

// Attempt to load the Setup module
let Setup;
try {
    Setup = require('../Startup/Setup');
} catch (error) {
    console.error('[VERIFICATION] Error loading Setup module:', error);
}

// Store for active captchas
const activeCaptchas = new Map();
// Store for verification settings
const verificationSettings = new Map();
// Cache for verification messages
const verificationMessages = new Map();

/**
 * Initialize the verification system
 */
function init() {
    console.log('[VERIFICATION] Verification system loaded');
    loadVerificationSettings();
    return true;
}

/**
 * Load verification settings from disk
 */
function loadVerificationSettings() {
    try {
        const dataDir = path.join(__dirname, '../../data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        const settingsPath = path.join(dataDir, 'verification.json');
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            const settings = JSON.parse(data);
            
            // Convert to Map
            Object.entries(settings).forEach(([guildId, setting]) => {
                verificationSettings.set(guildId, setting);
            });
            
            console.log(`[VERIFICATION] Loaded settings for ${verificationSettings.size} guilds`);
        } else {
            console.log('[VERIFICATION] No verification settings found');
        }
    } catch (error) {
        console.error('[VERIFICATION] Error loading verification settings:', error);
    }
}

/**
 * Save verification settings to disk
 */
function saveVerificationSettings() {
    try {
        const dataDir = path.join(__dirname, '../../data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        const settingsPath = path.join(dataDir, 'verification.json');
        
        // Convert Map to Object for serialization
        const settings = {};
        verificationSettings.forEach((value, key) => {
            settings[key] = value;
        });
        
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        console.log('[VERIFICATION] Verification settings saved');
    } catch (error) {
        console.error('[VERIFICATION] Error saving verification settings:', error);
    }
}

/**
 * Generate a captcha image
 * @returns {Object} Captcha details including solution and data URL
 */
async function generateCaptcha() {
    const width = 300;
    const height = 100;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Generate random 6-digit code
    const captchaCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Fill background
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);
    
    // Add noise (dots)
    for (let i = 0; i < 1000; i++) {
        ctx.fillStyle = `rgba(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255},0.3)`;
        ctx.beginPath();
        ctx.arc(Math.random() * width, Math.random() * height, 1, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Add noise (lines)
    for (let i = 0; i < 10; i++) {
        ctx.strokeStyle = `rgba(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255},0.5)`;
        ctx.beginPath();
        ctx.moveTo(Math.random() * width, Math.random() * height);
        ctx.lineTo(Math.random() * width, Math.random() * height);
        ctx.stroke();
    }
    
    // Add text
    ctx.font = '38px Arial';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(captchaCode, width / 2, height / 2);
    
    // Return the captcha details
    return {
        solution: captchaCode,
        dataUrl: canvas.toDataURL('image/png')
    };
}

/**
 * Create a verification button
 * @param {string} type - Type of verification ('button' or 'captcha')
 * @returns {ActionRowBuilder} Action row with the button
 */
function createVerificationButton(type) {
    const button = new ButtonBuilder()
        .setCustomId(`verify_${type}`)
        .setStyle(type === 'button' ? ButtonStyle.Success : ButtonStyle.Primary)
        .setLabel(type === 'button' ? 'Verify' : 'Complete Captcha');
    
    if (type === 'button') {
        button.setEmoji('✅');
    } else {
        button.setEmoji('🔐');
    }
    
    return new ActionRowBuilder().addComponents(button);
}

/**
 * Handle button-based verification
 * @param {Interaction} interaction - Button interaction
 */
async function handleButtonVerification(interaction) {
    try {
        const { guild, member, customId } = interaction;
        
        // Get verification settings
        const settings = verificationSettings.get(guild.id);
        if (!settings || !settings.buttonRole) {
            return interaction.reply({
                content: 'Verification system is not properly configured.',
                ephemeral: true
            });
        }
        
        // Get the role
        const role = await guild.roles.fetch(settings.buttonRole).catch(() => null);
        if (!role) {
            return interaction.reply({
                content: 'The verification role could not be found. Please contact an administrator.',
                ephemeral: true
            });
        }
        
        // Check if user already has the role
        if (member.roles.cache.has(role.id)) {
            return interaction.reply({
                content: 'You are already verified!',
                ephemeral: true
            });
        }
        
        // Assign the role
        await member.roles.add(role);
        
        // Reply to the user
        await interaction.reply({
            content: '✅ You have been successfully verified!',
            ephemeral: true
        });
        
        // Log verification if logging channel is configured
        logVerification(guild, member, 'button');
    } catch (error) {
        console.error('[VERIFICATION] Error handling button verification:', error);
        await interaction.reply({
            content: 'An error occurred during verification. Please try again later.',
            ephemeral: true
        }).catch(() => {});
    }
}

/**
 * Handle captcha verification - initial request
 * @param {Interaction} interaction - Button interaction
 */
async function handleCaptchaRequest(interaction) {
    try {
        // Defer the reply to give us time to generate the captcha
        await interaction.deferReply({ ephemeral: true });
        
        const { guild, member, customId } = interaction;
        
        // Get verification settings
        const settings = verificationSettings.get(guild.id);
        if (!settings || !settings.captchaRole) {
            return interaction.editReply({
                content: 'Captcha verification system is not properly configured.',
                ephemeral: true
            });
        }
        
        // Get the role
        const role = await guild.roles.fetch(settings.captchaRole).catch(() => null);
        if (!role) {
            return interaction.editReply({
                content: 'The verification role could not be found. Please contact an administrator.',
                ephemeral: true
            });
        }
        
        // Check if user already has the role
        if (member.roles.cache.has(role.id)) {
            return interaction.editReply({
                content: 'You are already verified!',
                ephemeral: true
            });
        }
        
        try {
            // Generate a captcha
            const captcha = await generateCaptcha();
            
            // Create a unique ID for this captcha session
            const captchaId = crypto.randomBytes(16).toString('hex');
            
            // Store the captcha solution
            activeCaptchas.set(captchaId, {
                solution: captcha.solution,
                userId: member.id,
                guildId: guild.id,
                expires: Date.now() + 5 * 60 * 1000 // 5 minutes expiry
            });
            
            // Extract base64 data properly
            const base64Data = captcha.dataUrl.split(',')[1];
            if (!base64Data) {
                throw new Error('Invalid captcha data URL format');
            }
            
            // Create a buffer from the base64 data
            const imageBuffer = Buffer.from(base64Data, 'base64');
            
            // Send the captcha image and button in one reply
            await interaction.editReply({
                content: 'Please solve the captcha below:',
                files: [{
                    attachment: imageBuffer,
                    name: 'captcha.png'
                }],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`captcha_modal_${captchaId}`)
                            .setLabel('Enter Code')
                            .setStyle(ButtonStyle.Primary)
                    )
                ],
                ephemeral: true
            });
            
            console.log(`[VERIFICATION] Captcha generated for user ${member.user.tag} (${member.user.id})`);
        } catch (captchaError) {
            console.error('[VERIFICATION] Error generating captcha:', captchaError);
            return interaction.editReply({
                content: 'Error generating captcha image. Please try again later.',
                ephemeral: true
            });
        }
    } catch (error) {
        console.error('[VERIFICATION] Error handling captcha request:', error);
        try {
            if (interaction.deferred) {
                await interaction.editReply({
                    content: 'An error occurred during verification. Please try again later.',
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: 'An error occurred during verification. Please try again later.',
                    ephemeral: true
                });
            }
        } catch (followupError) {
            console.error('[VERIFICATION] Error sending error response:', followupError);
        }
    }
}

/**
 * Handle the captcha modal button press
 * @param {Interaction} interaction - Button interaction
 */
async function handleCaptchaModal(interaction) {
    try {
        const captchaId = interaction.customId.replace('captcha_modal_', '');
        
        // Get the captcha data
        const captchaData = activeCaptchas.get(captchaId);
        if (!captchaData) {
            return interaction.reply({
                content: 'This verification request has expired. Please try again.',
                ephemeral: true
            });
        }
        
        // Show the modal
        const modal = new ModalBuilder()
            .setCustomId(`captcha_verify_${captchaId}`)
            .setTitle('Verification Captcha');
            
        // Add the captcha input field
        const captchaInput = new TextInputBuilder()
            .setCustomId('captcha_input')
            .setLabel('Enter the 6-digit code from the image')
            .setPlaceholder('Enter code here')
            .setStyle(TextInputStyle.Short)
            .setMinLength(6)
            .setMaxLength(6)
            .setRequired(true);
            
        // Add the input to the modal
        const actionRow = new ActionRowBuilder().addComponents(captchaInput);
        modal.addComponents(actionRow);
        
        // Show the modal
        await interaction.showModal(modal);
    } catch (error) {
        console.error('[VERIFICATION] Error showing captcha modal:', error);
        await interaction.reply({
            content: 'An error occurred during verification. Please try again later.',
            ephemeral: true
        }).catch(() => {});
    }
}

/**
 * Handle captcha verification - submission
 * @param {Interaction} interaction - Modal submission
 */
async function handleCaptchaSubmission(interaction) {
    try {
        const captchaId = interaction.customId.replace('captcha_verify_', '');
        
        // Get the captcha data
        const captchaData = activeCaptchas.get(captchaId);
        if (!captchaData) {
            return interaction.reply({
                content: 'This verification request has expired. Please try again.',
                ephemeral: true
            });
        }
        
        // Check if expired
        if (captchaData.expires < Date.now()) {
            activeCaptchas.delete(captchaId);
            return interaction.reply({
                content: 'This verification request has expired. Please try again.',
                ephemeral: true
            });
        }
        
        // Check if this is the right user
        if (captchaData.userId !== interaction.user.id) {
            return interaction.reply({
                content: 'This verification request is not for you.',
                ephemeral: true
            });
        }
        
        // Get the input
        const input = interaction.fields.getTextInputValue('captcha_input');
        
        // Check if the input matches the solution
        if (input !== captchaData.solution) {
            return interaction.reply({
                content: '❌ Incorrect captcha code. Please try again.',
                ephemeral: true
            });
        }
        
        // Get the guild
        const guild = interaction.client.guilds.cache.get(captchaData.guildId);
        if (!guild) {
            return interaction.reply({
                content: 'An error occurred during verification. Guild not found.',
                ephemeral: true
            });
        }
        
        // Get settings
        const settings = verificationSettings.get(guild.id);
        if (!settings || !settings.captchaRole) {
            return interaction.reply({
                content: 'Verification system is not properly configured.',
                ephemeral: true
            });
        }
        
        // Get the role
        const role = await guild.roles.fetch(settings.captchaRole).catch(() => null);
        if (!role) {
            return interaction.reply({
                content: 'The verification role could not be found. Please contact an administrator.',
                ephemeral: true
            });
        }
        
        // Get the member
        const member = await guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member) {
            return interaction.reply({
                content: 'An error occurred during verification. Member not found.',
                ephemeral: true
            });
        }
        
        // Assign the role
        await member.roles.add(role);
        
        // Delete the captcha data
        activeCaptchas.delete(captchaId);
        
        // Reply to the user
        await interaction.reply({
            content: '✅ Captcha solved correctly. You have been successfully verified!',
            ephemeral: true
        });
        
        // Log verification
        logVerification(guild, member, 'captcha');
    } catch (error) {
        console.error('[VERIFICATION] Error handling captcha submission:', error);
        await interaction.reply({
            content: 'An error occurred during verification. Please try again later.',
            ephemeral: true
        }).catch(() => {});
    }
}

/**
 * Log verification to the configured logs channel
 * @param {Guild} guild - Discord guild
 * @param {GuildMember} member - Verified member
 * @param {string} type - Verification type ('button' or 'captcha')
 */
async function logVerification(guild, member, type) {
    try {
        // Try to get the logging module
        const Logging = require('./Logging');
        
        // Create a log embed
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ User Verified')
            .addFields(
                { name: 'User', value: `${member.user.tag} (${member.user.id})` },
                { name: 'Verification Type', value: type === 'button' ? 'Button Click' : 'Captcha Solution' },
                { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>` }
            )
            .setTimestamp();
            
        // Log to channel using the Logging module if available
        if (Logging && typeof Logging.logToChannel === 'function') {
            await Logging.logToChannel(guild, embed);
        }
    } catch (error) {
        console.error('[VERIFICATION] Error logging verification:', error);
    }
}

/**
 * Handle interaction with verification system
 * @param {Interaction} interaction - Discord interaction
 */
async function handleInteraction(interaction) {
    // Handle button verifications
    if (interaction.isButton()) {
        if (interaction.customId === 'verify_button') {
            return handleButtonVerification(interaction);
        } else if (interaction.customId === 'verify_captcha') {
            return handleCaptchaRequest(interaction);
        } else if (interaction.customId.startsWith('captcha_modal_')) {
            return handleCaptchaModal(interaction);
        }
    }
    
    // Handle modal submissions (captcha verification)
    if (interaction.isModalSubmit() && interaction.customId.startsWith('captcha_verify_')) {
        return handleCaptchaSubmission(interaction);
    }
}

/**
 * Setup slash commands for verification
 * @returns {Array} - Array of slash command definitions
 */
function getCommands() {
    return [
        new SlashCommandBuilder()
            .setName('reactionrole')
            .setDescription('Setup a button-based verification system')
            .addChannelOption(option => 
                option.setName('channel')
                    .setDescription('Channel to send the verification message')
                    .setRequired(true))
            .addRoleOption(option => 
                option.setName('role')
                    .setDescription('Role to assign when verified')
                    .setRequired(true))
            .addStringOption(option => 
                option.setName('title')
                    .setDescription('Title for the verification message')
                    .setRequired(false))
            .addStringOption(option => 
                option.setName('description')
                    .setDescription('Description for the verification message')
                    .setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
            
        new SlashCommandBuilder()
            .setName('captchaverify')
            .setDescription('Setup a captcha-based verification system')
            .addChannelOption(option => 
                option.setName('channel')
                    .setDescription('Channel to send the verification message')
                    .setRequired(true))
            .addRoleOption(option => 
                option.setName('role')
                    .setDescription('Role to assign when verified')
                    .setRequired(true))
            .addStringOption(option => 
                option.setName('title')
                    .setDescription('Title for the verification message')
                    .setRequired(false))
            .addStringOption(option => 
                option.setName('description')
                    .setDescription('Description for the verification message')
                    .setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    ];
}

/**
 * Execute the verification setup commands
 * @param {Interaction} interaction - Command interaction
 */
async function executeCommand(interaction) {
    const { commandName, options, guild } = interaction;
    
    try {
        // Handle reaction role command
        if (commandName === 'reactionrole') {
            const channel = options.getChannel('channel');
            const role = options.getRole('role');
            const title = options.getString('title') || 'Server Verification';
            const description = options.getString('description') || 
                'Click the button below to verify yourself and gain access to the server.';
            
            // Ensure the channel is a text channel
            if (!channel.isTextBased()) {
                return interaction.reply({
                    content: 'The selected channel must be a text channel.',
                    ephemeral: true
                });
            }
            
            // Create the embed
            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle(title)
                .setDescription(description)
                .setFooter({ text: `Verification for ${guild.name}` })
                .setTimestamp();
                
            // Create the button
            const buttonRow = createVerificationButton('button');
            
            // Send the message
            const message = await channel.send({
                embeds: [embed],
                components: [buttonRow]
            });
            
            // Save settings
            const settings = verificationSettings.get(guild.id) || {};
            settings.buttonRole = role.id;
            settings.buttonChannelId = channel.id;
            settings.buttonMessageId = message.id;
            verificationSettings.set(guild.id, settings);
            saveVerificationSettings();
            
            // Cache the message for reference
            verificationMessages.set(`${guild.id}_button`, message.id);
            
            // Confirm to the user
            return interaction.reply({
                content: `✅ Verification system set up in ${channel} with role ${role.name}`,
                ephemeral: true
            });
        }
        
        // Handle captcha verification command
        if (commandName === 'captchaverify') {
            const channel = options.getChannel('channel');
            const role = options.getRole('role');
            const title = options.getString('title') || 'Captcha Verification';
            const description = options.getString('description') || 
                'Click the button below to complete a captcha and gain access to the server.';
            
            // Ensure the channel is a text channel
            if (!channel.isTextBased()) {
                return interaction.reply({
                    content: 'The selected channel must be a text channel.',
                    ephemeral: true
                });
            }
            
            // Create the embed
            const embed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle(title)
                .setDescription(description)
                .setFooter({ text: `Captcha Verification for ${guild.name}` })
                .setTimestamp();
                
            // Create the button
            const buttonRow = createVerificationButton('captcha');
            
            // Send the message
            const message = await channel.send({
                embeds: [embed],
                components: [buttonRow]
            });
            
            // Save settings
            const settings = verificationSettings.get(guild.id) || {};
            settings.captchaRole = role.id;
            settings.captchaChannelId = channel.id;
            settings.captchaMessageId = message.id;
            verificationSettings.set(guild.id, settings);
            saveVerificationSettings();
            
            // Cache the message for reference
            verificationMessages.set(`${guild.id}_captcha`, message.id);
            
            // Confirm to the user
            return interaction.reply({
                content: `✅ Captcha verification system set up in ${channel} with role ${role.name}`,
                ephemeral: true
            });
        }
    } catch (error) {
        console.error('[VERIFICATION] Error executing command:', error);
        return interaction.reply({
            content: 'An error occurred while setting up the verification system. Please try again later.',
            ephemeral: true
        }).catch(() => {});
    }
}

// Initialize on module load
init();

module.exports = {
    handleInteraction,
    getCommands,
    executeCommand
};
