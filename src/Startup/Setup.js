const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ChannelSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// Ensure config directory exists
const configDir = path.join(__dirname, '../../config');
if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
}

// Function to save server configuration
function saveServerConfig(guildId, config) {
    const configFile = path.join(configDir, `${guildId}.json`);
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    console.log(`Saved configuration for guild ${guildId}`);
}

// Function to load server configuration
function loadServerConfig(guildId) {
    const configFile = path.join(configDir, `${guildId}.json`);
    
    if (fs.existsSync(configFile)) {
        try {
            const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            return config;
        } catch (error) {
            console.error(`Error loading config for guild ${guildId}:`, error);
            return createDefaultConfig(guildId);
        }
    }
    
    return createDefaultConfig(guildId);
}

// Function to create default config
function createDefaultConfig(guildId) {
    return {
        guild: {
            id: guildId
        },
        channels: {},
        welcome: {
            enabled: false
        },
        goodbye: {
            enabled: false
        },
        inviteTracking: {
            enabled: false
        }
    };
}

// Setup command
const setupCommand = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure the bot for your server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        // Initial setup embed
        const setupEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🔧 Black Diamond Bot Setup')
            .setDescription('Welcome to the setup process! Please configure the channels for different bot features.')
            .addFields(
                { name: 'Instructions', value: 'Use the channel select menus below to choose channels for each feature. When you\'re done, click the Save Settings button.' }
            )
            .setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'Black Diamond Bot • Created with ❤️', iconURL: interaction.client.user.displayAvatarURL() })
            .setTimestamp();
            
        // Welcome channel menu
        const welcomeChannelRow = new ActionRowBuilder()
            .addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('welcome_channel')
                    .setPlaceholder('Select Welcome Channel')
                    .setChannelTypes(ChannelType.GuildText)
            );
            
        // Goodbye channel menu
        const goodbyeChannelRow = new ActionRowBuilder()
            .addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('goodbye_channel')
                    .setPlaceholder('Select Goodbye Channel')
                    .setChannelTypes(ChannelType.GuildText)
            );
            
        // Invite tracking channel menu
        const inviteChannelRow = new ActionRowBuilder()
            .addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('invite_channel')
                    .setPlaceholder('Select Invite Tracking Channel')
                    .setChannelTypes(ChannelType.GuildText)
            );
            
        // Logging channel menu
        const loggingChannelRow = new ActionRowBuilder()
            .addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('logging_channel')
                    .setPlaceholder('Select Logging Channel')
                    .setChannelTypes(ChannelType.GuildText)
            );
            
        // Currency/games channel menu
        const currencyChannelRow = new ActionRowBuilder()
            .addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('currency_channel')
                    .setPlaceholder('Select Economy & Games Channel')
                    .setChannelTypes(ChannelType.GuildText)
            );
            
        // Page navigation buttons
        const pageNavRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('prev_page')
                    .setLabel('Previous Page')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('next_page')
                    .setLabel('Next Page')
                    .setStyle(ButtonStyle.Secondary)
            );
            
        // Save button
        const buttonRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('save_setup')
                    .setLabel('Save Settings')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('cancel_setup')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Danger)
            );
        
        // Send the initial message with dropdowns (page 1)
        try {
            // Discord has a limit of 5 ActionRows per message
            // Create page system to show all options
            let currentPage = 1;
            const getComponentsForPage = (page) => {
                if (page === 1) {
                    return [welcomeChannelRow, goodbyeChannelRow, inviteChannelRow, pageNavRow, buttonRow];
                } else {
                    return [loggingChannelRow, currencyChannelRow, pageNavRow, buttonRow];
                }
            };
            
            const getUpdatedPageNav = (page) => {
                const newPageNavRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('prev_page')
                            .setLabel('Previous Page')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(page === 1),
                        new ButtonBuilder()
                            .setCustomId('next_page')
                            .setLabel('Next Page')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(page === 2)
                    );
                return newPageNavRow;
            };
            
            const message = await interaction.reply({
                embeds: [setupEmbed],
                components: getComponentsForPage(currentPage),
                ephemeral: true,
                fetchReply: true
            });
            
            // Create a collector for component interactions
            const collector = message.createMessageComponentCollector({ 
                time: 300000 // 5 minutes
            });
            
            // Store selections
            const selections = {
                channels: {}
            };
            
            collector.on('collect', async i => {
                // Make sure it's the same user
                if (i.user.id !== interaction.user.id) {
                    await i.reply({
                        content: 'You cannot use these controls as you did not run the command.',
                        ephemeral: true
                    });
                    return;
                }
                
                // Handle page navigation
                if (i.isButton() && (i.customId === 'prev_page' || i.customId === 'next_page')) {
                    currentPage = i.customId === 'prev_page' ? 1 : 2;
                    
                    await i.update({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0x5865F2)
                                .setTitle('🔧 Black Diamond Bot Setup')
                                .setDescription(`Setup Page ${currentPage}/2`)
                                .addFields(
                                    { name: 'Current Selections', value: Object.entries(selections.channels).map(([key, value]) => 
                                        `${key.replace('_channel', '')}: <#${value.id}>`).join('\n') || 'None selected'
                                    },
                                    { name: 'Instructions', value: 'Continue selecting channels or click Save Settings when done.' }
                                )
                                .setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true }))
                                .setFooter({ text: 'Black Diamond Bot • Created with ❤️', iconURL: interaction.client.user.displayAvatarURL() })
                                .setTimestamp()
                        ],
                        components: getComponentsForPage(currentPage)
                    });
                    return;
                }
                
                // Handle channel select menus
                if (i.isChannelSelectMenu()) {
                    const channelId = i.values[0];
                    const channelType = i.customId;
                    
                    // Save the selection
                    selections.channels[channelType] = {
                        id: channelId,
                        name: interaction.guild.channels.cache.get(channelId).name
                    };
                    
                    await i.update({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0x5865F2)
                                .setTitle('🔧 Black Diamond Bot Setup')
                                .setDescription(`You selected <#${channelId}> as the ${channelType.replace('_channel', '')} channel.`)
                                .addFields(
                                    { name: 'Current Selections', value: Object.entries(selections.channels).map(([key, value]) => 
                                        `${key.replace('_channel', '')}: <#${value.id}>`).join('\n') || 'None selected'
                                    },
                                    { name: 'Instructions', value: 'Continue selecting channels or click Save Settings when done.' }
                                )
                                .setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true }))
                                .setFooter({ text: 'Black Diamond Bot • Created with ❤️', iconURL: interaction.client.user.displayAvatarURL() })
                                .setTimestamp()
                        ],
                        components: getComponentsForPage(currentPage)
                    });
                }
                
                // Handle save button
                if (i.isButton() && i.customId === 'save_setup') {
                    // Get or create server config
                    const config = loadServerConfig(interaction.guild.id);
                    
                    // Update config with selections
                    if (!config.channels) {
                        config.channels = {};
                    }
                    
                    // Update channels
                    for (const [channelType, channelData] of Object.entries(selections.channels)) {
                        config.channels[channelType] = channelData;
                        
                        // Enable related features
                        if (channelType === 'welcome_channel') {
                            if (!config.welcome) config.welcome = {};
                            config.welcome.enabled = true;
                            config.welcome.mentionUser = true;
                            config.welcome.showMemberCount = true;
                            config.welcome.color = 0x3498DB;
                            config.welcome.title = 'Welcome to {server}!';
                            config.welcome.message = 'Hi {mention}, welcome to **{server}**! You are our {membercount}th member!';
                            config.welcome.footer = 'Joined {server}';
                        } else if (channelType === 'goodbye_channel') {
                            if (!config.goodbye) config.goodbye = {};
                            config.goodbye.enabled = true;
                            config.goodbye.showMemberCount = true;
                            config.goodbye.showJoinDate = true;
                            config.goodbye.showRoles = true;
                            config.goodbye.color = 0xE74C3C;
                            config.goodbye.title = 'Goodbye, {user}!';
                            config.goodbye.message = "We're sad to see you go, {user}. Thanks for being with us!";
                            config.goodbye.footer = 'Left {server}';
                        } else if (channelType === 'invite_channel') {
                            if (!config.inviteTracking) config.inviteTracking = {};
                            config.inviteTracking.enabled = true;
                            config.inviteTracking.logJoins = true;
                            config.inviteTracking.logInviteCreation = true;
                            config.inviteTracking.logInviteDeletion = true;
                            config.inviteTracking.color = 0x2ECC71;
                        } else if (channelType === 'logging_channel') {
                            if (!config.logging) config.logging = {};
                            config.logging.enabled = true;
                            config.logging.logMessageDelete = true;
                            config.logging.logMessageEdit = true;
                            config.logging.logChannelCreate = true;
                            config.logging.logChannelDelete = true;
                            config.logging.logMemberJoin = true;
                            config.logging.logMemberLeave = true;
                            config.logging.logMemberUpdate = true;
                            config.logging.logVoiceUpdate = true;
                            config.logging.color = 0x9B59B6;
                        } else if (channelType === 'currency_channel') {
                            if (!config.economy) config.economy = {};
                            config.economy.enabled = true;
                            config.economy.startingBalance = 1000;
                            config.economy.dailyAmount = 200;
                            config.economy.workMinAmount = 50;
                            config.economy.workMaxAmount = 200;
                            config.economy.color = 0xF1C40F;
                        }
                    }
                    
                    // Save the config
                    saveServerConfig(interaction.guild.id, config);
                    
                    // Create private success embed
                    const privateSuccessEmbed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('✅ Setup Complete!')
                        .setDescription('Thank you for setting up Black Diamond Bot!')
                        .addFields(
                            { name: 'Configuration Saved', value: 'Your channel preferences have been saved successfully.' },
                            { name: 'Selected Channels', value: Object.entries(selections.channels).map(([key, value]) => 
                                `${key.replace('_channel', '')}: <#${value.id}>`).join('\n') || 'None selected'
                            },
                            { 
                                name: '📝 Developer Note', 
                                value: 'Thank you for using Black Diamond Bot! This bot was crafted to help moderate and enhance your server experience. For any questions or issues, please contact the bot developer.',
                                inline: false 
                            },
                            { 
                                name: '❓ Need Help?', 
                                value: 'Use `/help` to see all available commands and features.',
                                inline: false 
                            }
                        )
                        .setFooter({ text: 'Black Diamond Bot • Created with ❤️', iconURL: interaction.client.user.displayAvatarURL() })
                        .setTimestamp();
                    
                    // Update the private message
                    await i.update({
                        embeds: [privateSuccessEmbed],
                        components: []
                    });
                    
                    // Send public confirmation
                    if (Object.keys(selections.channels).length > 0) {
                        // Create public confirmation embed
                        const publicEmbed = new EmbedBuilder()
                            .setColor(0x5865F2)
                            .setTitle('✨ Black Diamond Bot Set Up')
                            .setDescription(`${interaction.user} has completed the setup of Black Diamond Bot for this server!`)
                            .setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true }))
                            .addFields(
                                {
                                    name: 'About Black Diamond',
                                    value: 'Black Diamond is a multi-purpose Discord bot with moderation, welcome/goodbye messages, server logging, and economy features.',
                                    inline: false
                                },
                                { 
                                    name: '👋 New Member Welcomes', 
                                    value: selections.channels.welcome_channel 
                                        ? `Will be sent in <#${selections.channels.welcome_channel.id}>` 
                                        : 'Not configured'
                                },
                                { 
                                    name: '👋 Member Goodbyes', 
                                    value: selections.channels.goodbye_channel 
                                        ? `Will be sent in <#${selections.channels.goodbye_channel.id}>` 
                                        : 'Not configured'
                                },
                                { 
                                    name: '📝 Server Logs', 
                                    value: selections.channels.logging_channel 
                                        ? `Will be sent to <#${selections.channels.logging_channel.id}>` 
                                        : 'Not configured'
                                },
                                { 
                                    name: '💰 Economy & Games', 
                                    value: selections.channels.currency_channel 
                                        ? `Will be available in <#${selections.channels.currency_channel.id}>` 
                                        : 'Available in all channels'
                                },
                                { 
                                    name: '📊 Invite Tracking', 
                                    value: selections.channels.invite_channel 
                                        ? `Will be logged in <#${selections.channels.invite_channel.id}>` 
                                        : 'Not configured'
                                },
                                {
                                    name: 'Developer Note',
                                    value: 'Thank you for using Black Diamond! This bot was crafted with care to help moderate and enhance your server experience.',
                                    inline: false
                                },
                                {
                                    name: 'Need Help?',
                                    value: 'Use `/help` to see all available commands and features.',
                                    inline: false
                                }
                            )
                            .setFooter({ 
                                text: 'Black Diamond Bot • Created with ❤️', 
                                iconURL: interaction.client.user.displayAvatarURL() 
                            })
                            .setTimestamp();
                        
                        await interaction.channel.send({ embeds: [publicEmbed] });
                    }
                    
                    collector.stop();
                }
                
                // Handle cancel button
                if (i.isButton() && i.customId === 'cancel_setup') {
                    await i.update({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xFF0000)
                                .setTitle('❌ Setup Cancelled')
                                .setDescription('The setup process has been cancelled. No changes were made.')
                                .setFooter({ text: 'Black Diamond Bot • Created with ❤️', iconURL: interaction.client.user.displayAvatarURL() })
                                .setTimestamp()
                        ],
                        components: []
                    });
                    
                    collector.stop();
                }
            });
            
            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xFF0000)
                                .setTitle('⏱️ Setup Timed Out')
                                .setDescription('The setup process has timed out. Please run the command again if you want to configure the bot.')
                                .setFooter({ text: 'Black Diamond Bot • Created with ❤️', iconURL: interaction.client.user.displayAvatarURL() })
                        ],
                        components: []
                    }).catch(console.error);
                }
            });
        } catch (error) {
            console.error('Error in setup command:', error);
            await interaction.reply({
                content: 'There was an error executing the setup command. Please try again later.',
                ephemeral: true
            });
        }
    }
};

module.exports = {
    setupCommand,
    loadServerConfig,
    saveServerConfig,
    createDefaultConfig
};
