const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ChannelSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType,
    ApplicationCommandOptionType
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
            return null;
        }
    }
    
    return null;
}

// Setup command
const setupCommand = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure the bot for your server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('welcome_channel')
                .setDescription('Set the channel for welcome messages')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .addChannelOption(option =>
            option.setName('goodbye_channel')
                .setDescription('Set the channel for goodbye messages')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('welcome_enabled')
                .setDescription('Enable or disable welcome messages')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('goodbye_enabled')
                .setDescription('Enable or disable goodbye messages')
                .setRequired(false)
        ),
    
    async execute(interaction) {
        // Initial setup embed (only visible to the command user)
        const setupEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🔧 Black Diamond Bot Setup')
            .setDescription('Welcome to the setup process! Please configure the channels for different bot features.')
            .addFields(
                { name: 'Instructions', value: 'Use the channel select menus below to choose channels for each feature.' }
            )
            .setFooter({ text: 'You can run this command again at any time to update your settings.' });
            
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
            
        // Server logs channel menu
        const logsChannelRow = new ActionRowBuilder()
            .addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('logs_channel')
                    .setPlaceholder('Select Server Logs Channel')
                    .setChannelTypes(ChannelType.GuildText)
            );
            
        // Currency/games channel menu
        const currencyChannelRow = new ActionRowBuilder()
            .addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('currency_channel')
                    .setPlaceholder('Select Currency/Games Channel')
                    .setChannelTypes(ChannelType.GuildText)
            );
            
        // Save button
        const buttonRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('save_setup')
                    .setLabel('Save Settings')
                    .setStyle(ButtonStyle.Success)
            );
        
        // Store user selections
        const selections = {};
        
        // Process welcome/goodbye channel settings
        const welcomeChannel = interaction.options.getChannel('welcome_channel');
        const goodbyeChannel = interaction.options.getChannel('goodbye_channel');
        const welcomeEnabled = interaction.options.getBoolean('welcome_enabled');
        const goodbyeEnabled = interaction.options.getBoolean('goodbye_enabled');
        
        if (welcomeChannel) {
            if (!welcomeChannel.isTextBased()) {
                return interaction.reply({ content: 'Welcome channel must be a text channel.', ephemeral: true });
            }
            
            // Update config
            const serverConfig = loadServerConfig(interaction.guild.id);
            if (!serverConfig.channels) serverConfig.channels = {};
            serverConfig.channels.welcome_channel = {
                id: welcomeChannel.id,
                name: welcomeChannel.name
            };
            
            // Initialize welcome settings if not present
            if (!serverConfig.welcome) {
                serverConfig.welcome = {
                    enabled: true,
                    mentionUser: true,
                    showMemberCount: true,
                    color: 0x3498DB,
                    title: 'Welcome to {server}!',
                    message: 'Hi {mention}, welcome to **{server}**! You are our {membercount}th member!',
                    footer: 'Joined {server}'
                };
            }
            
            saveServerConfig(interaction.guild.id, serverConfig);
            selections.welcome_channel = {
                id: welcomeChannel.id,
                name: welcomeChannel.name
            };
        }
        
        if (goodbyeChannel) {
            if (!goodbyeChannel.isTextBased()) {
                return interaction.reply({ content: 'Goodbye channel must be a text channel.', ephemeral: true });
            }
            
            // Update config
            const serverConfig = loadServerConfig(interaction.guild.id);
            if (!serverConfig.channels) serverConfig.channels = {};
            serverConfig.channels.goodbye_channel = {
                id: goodbyeChannel.id,
                name: goodbyeChannel.name
            };
            
            // Initialize goodbye settings if not present
            if (!serverConfig.goodbye) {
                serverConfig.goodbye = {
                    enabled: true,
                    showMemberCount: true,
                    showJoinDate: true,
                    showRoles: true,
                    color: 0xE74C3C,
                    title: 'Goodbye, {user}!',
                    message: "We're sad to see you go, {user}. Thanks for being with us!",
                    footer: 'Left {server}'
                };
            }
            
            saveServerConfig(interaction.guild.id, serverConfig);
            selections.goodbye_channel = {
                id: goodbyeChannel.id,
                name: goodbyeChannel.name
            };
        }
        
        if (welcomeEnabled !== null) {
            // Update config
            const serverConfig = loadServerConfig(interaction.guild.id);
            
            // Initialize welcome settings if not present
            if (!serverConfig.welcome) {
                serverConfig.welcome = {
                    enabled: welcomeEnabled,
                    mentionUser: true,
                    showMemberCount: true,
                    color: 0x3498DB,
                    title: 'Welcome to {server}!',
                    message: 'Hi {mention}, welcome to **{server}**! You are our {membercount}th member!',
                    footer: 'Joined {server}'
                };
            } else {
                serverConfig.welcome.enabled = welcomeEnabled;
            }
            
            saveServerConfig(interaction.guild.id, serverConfig);
            selections.welcome_enabled = welcomeEnabled;
        }
        
        if (goodbyeEnabled !== null) {
            // Update config
            const serverConfig = loadServerConfig(interaction.guild.id);
            
            // Initialize goodbye settings if not present
            if (!serverConfig.goodbye) {
                serverConfig.goodbye = {
                    enabled: goodbyeEnabled,
                    showMemberCount: true,
                    showJoinDate: true,
                    showRoles: true,
                    color: 0xE74C3C,
                    title: 'Goodbye, {user}!',
                    message: "We're sad to see you go, {user}. Thanks for being with us!",
                    footer: 'Left {server}'
                };
            } else {
                serverConfig.goodbye.enabled = goodbyeEnabled;
            }
            
            saveServerConfig(interaction.guild.id, serverConfig);
            selections.goodbye_enabled = goodbyeEnabled;
        }
        
        // Send initial message (only visible to the person who triggered the command)
        const message = await interaction.reply({
            embeds: [setupEmbed],
            components: [welcomeChannelRow, goodbyeChannelRow, logsChannelRow, currencyChannelRow, buttonRow],
            fetchReply: true,
            ephemeral: true
        });
        
        // Create a collector to handle interactions with the components
        const componentCollector = message.createMessageComponentCollector({ time: 300000 }); // 5 minutes
        
        componentCollector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: 'Only the person who ran the command can interact with these components.', ephemeral: true });
                return;
            }
            
            // Handle channel selections
            if (i.isChannelSelectMenu()) {
                const channelId = i.values[0];
                const channel = await interaction.guild.channels.fetch(channelId);
                
                // Update selections object with the chosen channel
                selections[i.customId] = {
                    id: channelId,
                    name: channel.name
                };
                
                await i.update({
                    content: `Selected ${i.customId.replace('_channel', '')} channel: <#${channelId}>`,
                    components: [welcomeChannelRow, goodbyeChannelRow, logsChannelRow, currencyChannelRow, buttonRow]
                });
            }
            
            // Handle save button
            if (i.isButton() && i.customId === 'save_setup') {
                // Save the configuration
                const config = {
                    guild: {
                        id: interaction.guild.id,
                        name: interaction.guild.name
                    },
                    setupBy: {
                        id: interaction.user.id,
                        tag: interaction.user.tag
                    },
                    timestamp: new Date().toISOString(),
                    channels: selections
                };
                
                saveServerConfig(interaction.guild.id, config);
                
                // Create private success embed (only visible to the person who triggered the command)
                const privateSuccessEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Setup Complete!')
                    .setDescription('Thank you for setting up Black Diamond Bot!')
                    .addFields(
                        { name: 'Configuration Saved', value: 'Your channel preferences have been saved successfully.' },
                        { name: 'Selected Channels', value: Object.entries(selections).map(([key, value]) => 
                            `${key.replace('_channel', '')}: <#${value.id}>`).join('\n') || 'None selected'
                        }
                    );
                
                // Update the private response
                await i.update({
                    embeds: [privateSuccessEmbed],
                    components: [],
                    content: 'Your settings have been saved. A confirmation has been sent to the channel.'
                });
                
                // Create public confirmation embed (visible to everyone in the channel)
                const publicConfirmEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('✨ Black Diamond Bot Set Up')
                    .setDescription(`${interaction.user} has completed the setup of Black Diamond Bot for this server!`)
                    .setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .addFields(
                        { name: 'About Black Diamond', value: 'Black Diamond is a multi-purpose Discord bot with moderation, welcome/goodbye messages, server logging, and economy features.' },
                        { name: '👋 New Member Welcomes', value: selections.welcome_channel ? `Will be sent in <#${selections.welcome_channel.id}>` : 'Not configured' },
                        { name: '👋 Member Goodbyes', value: selections.goodbye_channel ? `Will be sent in <#${selections.goodbye_channel.id}>` : 'Not configured' },
                        { name: '📝 Server Logs', value: selections.logs_channel ? `Will be sent to <#${selections.logs_channel.id}>` : 'Not configured' },
                        { name: '💰 Economy & Games', value: selections.currency_channel ? `Will be available in <#${selections.currency_channel.id}>` : 'Not configured' },
                        { name: 'Developer Note', value: 'Thank you for using Black Diamond! This bot was crafted with care to help moderate and enhance your server experience.' },
                        { name: 'Need Help?', value: 'Use `/help` to see all available commands and features.' }
                    )
                    .setFooter({ text: 'Black Diamond Bot • Created with ❤️', iconURL: interaction.client.user.displayAvatarURL() })
                    .setTimestamp();
                
                // Send the public message to the channel
                await interaction.channel.send({ embeds: [publicConfirmEmbed] });
                
                componentCollector.stop();
            }
        });
        
        componentCollector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({
                    content: 'Setup timed out. Please run the command again.',
                    embeds: [],
                    components: []
                }).catch(console.error);
            }
        });
    }
};

// Export the Setup command and utility functions
module.exports = {
    setupCommand,
    loadServerConfig,
    saveServerConfig
};
