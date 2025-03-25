const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType
} = require('discord.js');
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    NoSubscriberBehavior, 
    AudioPlayerStatus, 
    getVoiceConnection,
    VoiceConnectionStatus,
    entersState,
    createAudioResource
} = require('@discordjs/voice');
const Sound = require('./Sound');
const fs = require('fs');
const path = require('path');

// Store queues for each guild
const queues = new Map();
// Store players for each guild
const players = new Map();
// Store the connection status for each guild
const connectionStatus = new Map();

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Function to save the queue to disk
function saveQueue(guildId, queue) {
    const queuesFile = path.join(dataDir, 'music_queues.json');
    let queuesData = {};
    
    if (fs.existsSync(queuesFile)) {
        try {
            queuesData = JSON.parse(fs.readFileSync(queuesFile, 'utf8'));
        } catch (error) {
            console.error('Error reading music queues file:', error);
        }
    }
    
    queuesData[guildId] = queue.map(track => ({
        title: track.title,
        url: track.url,
        thumbnail: track.thumbnail,
        duration: track.duration,
        author: track.author,
        requestedBy: track.requestedBy,
        type: track.type
    }));
    
    fs.writeFileSync(queuesFile, JSON.stringify(queuesData, null, 2));
}

// Function to load the queue from disk
function loadQueue(guildId) {
    const queuesFile = path.join(dataDir, 'music_queues.json');
    
    if (fs.existsSync(queuesFile)) {
        try {
            const queuesData = JSON.parse(fs.readFileSync(queuesFile, 'utf8'));
            return queuesData[guildId] || [];
        } catch (error) {
            console.error('Error reading music queues file:', error);
        }
    }
    
    return [];
}

// Get or create a queue for a guild
function getQueue(guildId) {
    if (!queues.has(guildId)) {
        const savedQueue = loadQueue(guildId);
        queues.set(guildId, savedQueue);
    }
    return queues.get(guildId);
}

// Create a player for a guild
function createPlayer(guildId) {
    const player = createAudioPlayer({
        behaviors: {
            noSubscriber: NoSubscriberBehavior.Pause,
        },
    });
    
    player.on(AudioPlayerStatus.Idle, () => {
        console.log(`[MUSIC] Player for guild ${guildId} is now idle`);
        playNext(guildId);
    });
    
    player.on(AudioPlayerStatus.Playing, () => {
        console.log(`[MUSIC] Player for guild ${guildId} is now playing`);
    });
    
    player.on('error', error => {
        console.error(`[MUSIC] Error in guild ${guildId}:`, error);
        playNext(guildId);
    });
    
    players.set(guildId, player);
    return player;
}

// Get or create a player for a guild
function getPlayer(guildId) {
    if (!players.has(guildId)) {
        return createPlayer(guildId);
    }
    return players.get(guildId);
}

// Join a voice channel
async function joinChannel(channel, interaction) {
    try {
        console.log(`[MUSIC] Attempting to join voice channel: ${channel.id} in guild: ${channel.guild.id}`);
        
        // Check if already connected to this channel
        let existingConnection = getVoiceConnection(channel.guild.id);
        if (existingConnection && existingConnection.joinConfig.channelId === channel.id) {
            console.log(`[MUSIC] Already connected to channel ${channel.id}`);
            return existingConnection;
        }
        
        // Destroy any existing connection
        if (existingConnection) {
            console.log(`[MUSIC] Destroying existing connection to join new channel`);
            existingConnection.destroy();
        }
        
        // Create new connection
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: false, // Try with selfDeaf false to ensure audio playback
            selfMute: false,
        });
        
        console.log(`[MUSIC] Connection created with status: ${connection.state.status}`);
        
        // Wait for connection to be ready
        try {
            await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
            console.log(`[MUSIC] Connection is ready in channel ${channel.id}`);
        } catch (error) {
            console.error(`[MUSIC] Connection failed to be ready:`, error);
            if (interaction) {
                await interaction.followUp({
                    content: '❌ Failed to establish a stable connection to the voice channel!',
                    ephemeral: true
                });
            }
            connection.destroy();
            return null;
        }
        
        // Set up disconnection handler
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                console.log(`[MUSIC] Connection disconnected, attempting to reconnect...`);
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
                // Seems to be reconnecting to a new channel
                console.log(`[MUSIC] Connection is reconnecting...`);
            } catch (error) {
                // Seems to be a real disconnect which SHOULDN'T be recovered from
                console.log(`[MUSIC] Connection permanently disconnected:`, error);
                connection.destroy();
                clearQueue(channel.guild.id);
            }
        });
        
        // Set up debug handlers
        connection.on(VoiceConnectionStatus.Connecting, () => {
            console.log(`[MUSIC] Connection is connecting...`);
        });
        
        connection.on(VoiceConnectionStatus.Signalling, () => {
            console.log(`[MUSIC] Connection is signalling...`);
        });
        
        connection.on(VoiceConnectionStatus.Ready, () => {
            console.log(`[MUSIC] Connection is ready!`);
        });
        
        connectionStatus.set(channel.guild.id, true);
        
        // Subscribe the connection to the audio player
        const player = getPlayer(channel.guild.id);
        connection.subscribe(player);
        
        return connection;
    } catch (error) {
        console.error('[MUSIC] Error joining voice channel:', error);
        if (interaction) {
            await interaction.followUp({
                content: `❌ There was an error joining the voice channel: ${error.message}`,
                ephemeral: true
            });
        }
        return null;
    }
}

// Leave a voice channel
function leaveChannel(guildId) {
    const connection = getVoiceConnection(guildId);
    if (connection) {
        connection.destroy();
        connectionStatus.set(guildId, false);
        return true;
    }
    return false;
}

// Add a track to the queue
async function addToQueue(guildId, track, interaction) {
    const queue = getQueue(guildId);
    queue.push(track);
    saveQueue(guildId, queue);
    
    if (queue.length === 1 && (!players.has(guildId) || getPlayer(guildId).state.status === AudioPlayerStatus.Idle)) {
        await playTrack(guildId, 0, interaction);
    } else if (interaction) {
        const embed = Sound.createNowPlayingEmbed(track, {
            queuePosition: queue.length,
            queueLength: queue.length
        });
        embed.setTitle('🎵 Added to Queue');
        
        await interaction.followUp({ embeds: [embed] });
    }
}

// Play a track from the queue
async function playTrack(guildId, index, interaction) {
    try {
        const queue = getQueue(guildId);
        if (queue.length === 0 || index >= queue.length) {
            if (interaction) {
                await interaction.followUp({
                    content: '❌ There are no songs in the queue!',
                    ephemeral: true
                });
            }
            return false;
        }
        
        const track = queue[index];
        console.log(`[MUSIC] Playing track: ${track.title} in guild ${guildId}`);
        
        // Get the player and connection
        const player = getPlayer(guildId);
        const connection = getVoiceConnection(guildId);
        
        if (!connection) {
            if (interaction) {
                await interaction.followUp({
                    content: '❌ Bot is not connected to a voice channel!',
                    ephemeral: true
                });
            }
            return false;
        }
        
        // Make sure connection is ready before playing
        if (connection.state.status !== VoiceConnectionStatus.Ready) {
            try {
                await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
                console.log(`[MUSIC] Connection is now ready in guild ${guildId}`);
            } catch (error) {
                console.error(`[MUSIC] Connection failed to be ready in guild ${guildId}:`, error);
                if (interaction) {
                    await interaction.followUp({
                        content: '❌ Voice connection is not ready. Please try again or use `/music join` first!',
                        ephemeral: true
                    });
                }
                return false;
            }
        }
        
        try {
            // Get audio resource from the track
            let resource;
            
            if (track.type === 'youtube') {
                console.log(`[MUSIC] Creating resource for track: ${track.title} (${track.url})`);
                const result = await Sound.createYouTubeResource(track.url);
                resource = result.resource;
                console.log(`[MUSIC] Resource created successfully. Volume:`, resource.volume ? 'available' : 'unavailable');
            } else {
                throw new Error('Unsupported track type');
            }
            
            // Subscribe connection to player if not already
            connection.subscribe(player);
            
            // Play the track
            console.log(`[MUSIC] Playing track with player state: ${player.state.status}`);
            player.play(resource);
            
            // Send now playing message if interaction is provided
            if (interaction) {
                const embed = Sound.createNowPlayingEmbed(track, {
                    queueLength: queue.length
                });
                
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('music_skip')
                            .setLabel('Skip')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('⏭️'),
                        new ButtonBuilder()
                            .setCustomId('music_pause')
                            .setLabel('Pause')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('⏸️'),
                        new ButtonBuilder()
                            .setCustomId('music_stop')
                            .setLabel('Stop')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('⏹️'),
                        new ButtonBuilder()
                            .setCustomId('music_queue')
                            .setLabel('Queue')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('📜')
                    );
                
                await interaction.followUp({ embeds: [embed], components: [row] });
            }
            
            return true;
        } catch (error) {
            console.error('[MUSIC] Error creating audio resource:', error);
            
            if (interaction) {
                await interaction.followUp({
                    content: `❌ Error playing track: ${error.message}`,
                    ephemeral: true
                });
            }
            
            // Try to play the next track
            queue.splice(index, 1);
            saveQueue(guildId, queue);
            return await playNext(guildId, interaction);
        }
    } catch (error) {
        console.error('[MUSIC] Error in playTrack:', error);
        return false;
    }
}

// Play the next track in the queue
async function playNext(guildId, interaction) {
    const queue = getQueue(guildId);
    
    if (queue.length === 0) {
        // Queue is empty, stop playing
        return false;
    }
    
    // Remove the first track (the one that just finished)
    queue.shift();
    saveQueue(guildId, queue);
    
    if (queue.length === 0) {
        // No more tracks, stop playing
        if (interaction) {
            await interaction.followUp({
                content: '✅ Queue finished! Add more tracks with `/music play`',
                ephemeral: true
            });
        }
        return false;
    }
    
    // Play the next track (which is now at index 0)
    return playTrack(guildId, 0, interaction);
}

// Skip to the next track
async function skipTrack(guildId, interaction) {
    const player = getPlayer(guildId);
    player.stop(); // This will trigger the 'idle' event, which will play the next track
    
    if (interaction) {
        await interaction.reply({
            content: '⏭️ Skipped to the next track!',
            ephemeral: true
        });
    }
    
    return true;
}

// Pause the player
async function pausePlayer(guildId, interaction) {
    const player = getPlayer(guildId);
    
    if (player.state.status === AudioPlayerStatus.Playing) {
        player.pause();
        
        if (interaction) {
            await interaction.reply({
                content: '⏸️ Paused the player!',
                ephemeral: true
            });
        }
        
        return true;
    } else if (player.state.status === AudioPlayerStatus.Paused) {
        player.unpause();
        
        if (interaction) {
            await interaction.reply({
                content: '▶️ Resumed the player!',
                ephemeral: true
            });
        }
        
        return true;
    }
    
    if (interaction) {
        await interaction.reply({
            content: '❌ Nothing is currently playing!',
            ephemeral: true
        });
    }
    
    return false;
}

// Stop the player and clear the queue
async function stopPlayer(guildId, interaction) {
    const player = getPlayer(guildId);
    player.stop();
    clearQueue(guildId);
    
    if (interaction) {
        await interaction.reply({
            content: '⏹️ Stopped the player and cleared the queue!',
            ephemeral: true
        });
    }
    
    return true;
}

// Clear the queue
function clearQueue(guildId) {
    queues.set(guildId, []);
    saveQueue(guildId, []);
    return true;
}

// Shuffle the queue
function shuffleQueue(guildId) {
    const queue = getQueue(guildId);
    
    if (queue.length <= 1) {
        return false;
    }
    
    // Get the current track
    const currentTrack = queue.shift();
    
    // Shuffle the remaining tracks
    for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    
    // Put the current track back at the beginning
    queue.unshift(currentTrack);
    
    saveQueue(guildId, queue);
    return true;
}

// Remove a track from the queue
function removeFromQueue(guildId, index) {
    const queue = getQueue(guildId);
    
    if (index < 0 || index >= queue.length) {
        return false;
    }
    
    if (index === 0) {
        // If removing the current track, stop it and start the next one
        const player = getPlayer(guildId);
        player.stop();
        return true;
    }
    
    // Remove the track
    queue.splice(index, 1);
    saveQueue(guildId, queue);
    return true;
}

// Disconnect from a voice channel and clean up
function disconnect(guildId) {
    leaveChannel(guildId);
    clearQueue(guildId);
    if (players.has(guildId)) {
        const player = players.get(guildId);
        player.stop();
        players.delete(guildId);
    }
    connectionStatus.delete(guildId);
    return true;
}

// Get the commands for the music system
function getMusicCommands() {
    return [
        new SlashCommandBuilder()
            .setName('music')
            .setDescription('Music commands')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('play')
                    .setDescription('Play a song or add it to the queue')
                    .addStringOption(option =>
                        option
                            .setName('query')
                            .setDescription('YouTube URL or search query')
                            .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('skip')
                    .setDescription('Skip to the next song in the queue')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('pause')
                    .setDescription('Pause or resume the current song')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('stop')
                    .setDescription('Stop playing and clear the queue')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('queue')
                    .setDescription('View the current queue')
                    .addIntegerOption(option =>
                        option
                            .setName('page')
                            .setDescription('Page number of the queue to view')
                            .setRequired(false)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('shuffle')
                    .setDescription('Shuffle the queue')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('remove')
                    .setDescription('Remove a song from the queue')
                    .addIntegerOption(option =>
                        option
                            .setName('position')
                            .setDescription('Position in the queue (1-based)')
                            .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('join')
                    .setDescription('Join your voice channel')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('leave')
                    .setDescription('Leave the voice channel')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('nowplaying')
                    .setDescription('Show the currently playing song')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('help')
                    .setDescription('Show help for music commands')
            )
    ];
}

// Handle music commands
async function handleMusicCommand(interaction) {
    if (!interaction.isCommand() || interaction.commandName !== 'music') {
        return false;
    }
    
    const subcommand = interaction.options.getSubcommand();
    
    // Check if the user is in a voice channel (for commands that require it)
    const requiresVoiceChannel = ['play', 'join', 'skip', 'pause', 'stop', 'shuffle', 'remove'];
    
    if (requiresVoiceChannel.includes(subcommand)) {
        const voiceChannel = interaction.member.voice.channel;
        
        if (!voiceChannel) {
            await interaction.reply({
                content: '❌ You need to be in a voice channel to use this command!',
                ephemeral: true
            });
            return true;
        }
        
        // Check bot permissions
        const permissions = voiceChannel.permissionsFor(interaction.client.user);
        
        if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
            await interaction.reply({
                content: '❌ I need permissions to join and speak in your voice channel!',
                ephemeral: true
            });
            return true;
        }
    }
    
    // Handle each subcommand
    try {
        await interaction.deferReply();
        
        switch (subcommand) {
            case 'play':
                await handlePlay(interaction);
                break;
            case 'skip':
                await skipTrack(interaction.guild.id, interaction);
                break;
            case 'pause':
                await pausePlayer(interaction.guild.id, interaction);
                break;
            case 'stop':
                await stopPlayer(interaction.guild.id, interaction);
                break;
            case 'queue':
                await handleQueue(interaction);
                break;
            case 'shuffle':
                await handleShuffle(interaction);
                break;
            case 'remove':
                await handleRemove(interaction);
                break;
            case 'join':
                await handleJoin(interaction);
                break;
            case 'leave':
                await handleLeave(interaction);
                break;
            case 'nowplaying':
                await handleNowPlaying(interaction);
                break;
            case 'help':
                await handleHelp(interaction);
                break;
            default:
                await interaction.followUp({
                    content: '❌ Unknown subcommand!',
                    ephemeral: true
                });
        }
        
        return true;
    } catch (error) {
        console.error('[MUSIC] Error handling music command:', error);
        
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({
                content: `❌ There was an error: ${error.message}`,
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: `❌ There was an error: ${error.message}`,
                ephemeral: true
            });
        }
        
        return true;
    }
}

// Handle play subcommand
async function handlePlay(interaction) {
    const query = interaction.options.getString('query');
    const voiceChannel = interaction.member.voice.channel;
    
    // Join the voice channel if not already in one
    let connection = getVoiceConnection(interaction.guild.id);
    
    if (!connection) {
        connection = await joinChannel(voiceChannel, interaction);
        
        if (!connection) {
            return;
        }
    }
    
    try {
        let result;
        
        // Check if it's a YouTube URL or a search query
        if (Sound.isYouTubeUrl(query)) {
            result = await Sound.createYouTubeResource(query);
        } else {
            result = await Sound.createFromSearch(query);
        }
        
        // Add track info
        const { resource, track } = result;
        track.requestedBy = interaction.user.username;
        
        // Add to queue and play
        await addToQueue(interaction.guild.id, track, interaction);
        
        // Successfully added to queue/played
        return true;
    } catch (error) {
        console.error('[MUSIC] Error handling play command:', error);
        
        if (error.message.includes('No search results found') || error.message.includes('No video found')) {
            await interaction.followUp({ 
                content: '❌ No matching songs found for your query. Please try a different search.',
                ephemeral: true
            });
        } else {
            await interaction.followUp({
                content: `❌ There was an error playing this track: ${error.message}`,
                ephemeral: true
            });
        }
        
        return false;
    }
}

// Handle queue subcommand
async function handleQueue(interaction) {
    const guildId = interaction.guild.id;
    const queue = getQueue(guildId);
    let page = 1;
    
    // Check if page option is provided
    if (interaction.options.getInteger) {
        const pageOption = interaction.options.getInteger('page');
        if (pageOption) page = pageOption;
    }
    
    if (queue.length === 0) {
        await interaction.followUp({
            content: '❌ The queue is empty!',
            ephemeral: true
        });
        return;
    }
    
    const embed = Sound.createQueueEmbed(queue, page);
    
    // Add navigation buttons if there are multiple pages
    const totalPages = Math.ceil(queue.length / 10);
    let components = [];
    
    if (totalPages > 1) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('queue_prev')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
                    .setDisabled(page === 1),
                new ButtonBuilder()
                    .setCustomId('queue_next')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('➡️')
                    .setDisabled(page === totalPages)
            );
        components.push(row);
    }
    
    await interaction.followUp({
        embeds: [embed],
        components: components,
        ephemeral: true
    });
}

// Handle shuffle subcommand
async function handleShuffle(interaction) {
    const shuffled = shuffleQueue(interaction.guild.id);
    
    if (shuffled) {
        await interaction.followUp({
            content: '🔀 Queue shuffled successfully!',
            ephemeral: true
        });
    } else {
        await interaction.followUp({
            content: '❌ There are not enough songs in the queue to shuffle!',
            ephemeral: true
        });
    }
}

// Handle remove subcommand
async function handleRemove(interaction) {
    const position = interaction.options.getInteger('position');
    const queue = getQueue(interaction.guild.id);
    
    if (position < 1 || position > queue.length) {
        await interaction.followUp({
            content: `❌ Invalid position! The queue has ${queue.length} songs.`,
            ephemeral: true
        });
        return;
    }
    
    const track = queue[position - 1];
    const removed = removeFromQueue(interaction.guild.id, position - 1);
    
    if (removed) {
        await interaction.followUp({
            content: `✅ Removed **${track.title}** from the queue!`,
            ephemeral: true
        });
    } else {
        await interaction.followUp({
            content: '❌ Failed to remove the track from the queue!',
            ephemeral: true
        });
    }
}

// Handle join subcommand
async function handleJoin(interaction) {
    const voiceChannel = interaction.member.voice.channel;
    
    // Check if already connected to this channel
    const connection = getVoiceConnection(interaction.guild.id);
    
    if (connection && connection.joinConfig.channelId === voiceChannel.id) {
        await interaction.followUp({
            content: '✅ I\'m already in your voice channel!',
            ephemeral: true
        });
        return;
    }
    
    const joined = await joinChannel(voiceChannel, interaction);
    
    if (joined) {
        await interaction.followUp({
            content: `✅ Joined ${voiceChannel.name}!`,
            ephemeral: true
        });
    }
}

// Handle leave subcommand
async function handleLeave(interaction) {
    const left = disconnect(interaction.guild.id);
    
    if (left) {
        await interaction.followUp({
            content: '👋 Left the voice channel and cleared the queue!',
            ephemeral: true
        });
    } else {
        await interaction.followUp({
            content: '❌ I\'m not in a voice channel!',
            ephemeral: true
        });
    }
}

// Handle nowplaying subcommand
async function handleNowPlaying(interaction) {
    const queue = getQueue(interaction.guild.id);
    
    if (queue.length === 0) {
        await interaction.followUp({
            content: '❌ Nothing is currently playing!',
            ephemeral: true
        });
        return;
    }
    
    const currentTrack = queue[0];
    const embed = Sound.createNowPlayingEmbed(currentTrack, {
        queueLength: queue.length
    });
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('music_skip')
                .setLabel('Skip')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⏭️'),
            new ButtonBuilder()
                .setCustomId('music_pause')
                .setLabel('Pause')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⏸️'),
            new ButtonBuilder()
                .setCustomId('music_stop')
                .setLabel('Stop')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⏹️'),
            new ButtonBuilder()
                .setCustomId('music_queue')
                .setLabel('Queue')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📜')
        );
        
    await interaction.followUp({ embeds: [embed], components: [row] });
}

// Handle help subcommand
async function handleHelp(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('🎵 Music Command Help')
        .setColor('#0099ff')
        .setDescription('Here are all the available music commands:')
        .addFields(
            { name: '/music play <query>', value: 'Play a song by URL or search', inline: true },
            { name: '/music skip', value: 'Skip to the next song', inline: true },
            { name: '/music pause', value: 'Pause/resume playback', inline: true },
            { name: '/music stop', value: 'Stop and clear the queue', inline: true },
            { name: '/music queue [page]', value: 'View the current queue', inline: true },
            { name: '/music shuffle', value: 'Shuffle the queue', inline: true },
            { name: '/music remove <position>', value: 'Remove a song from the queue', inline: true },
            { name: '/music join', value: 'Join your voice channel', inline: true },
            { name: '/music leave', value: 'Leave the voice channel', inline: true },
            { name: '/music nowplaying', value: 'Show current song', inline: true }
        )
        .setFooter({ text: 'Black Diamond Music Player' });
        
    await interaction.followUp({ embeds: [embed] });
}

// Handle the queue button
async function handleQueueButton(interaction) {
    const guildId = interaction.guild.id;
    const queue = getQueue(guildId);
    const page = 1; // Default to first page for button click
    
    if (queue.length === 0) {
        await interaction.reply({
            content: '❌ The queue is empty!',
            ephemeral: true
        });
        return;
    }
    
    const embed = Sound.createQueueEmbed(queue, page);
    
    // Add navigation buttons if there are multiple pages
    const totalPages = Math.ceil(queue.length / 10);
    let components = [];
    
    if (totalPages > 1) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('queue_prev')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
                    .setDisabled(page === 1),
                new ButtonBuilder()
                    .setCustomId('queue_next')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('➡️')
                    .setDisabled(page === totalPages)
            );
        components.push(row);
    }
    
    await interaction.reply({
        embeds: [embed],
        components: components,
        ephemeral: true
    });
}

// Handle music button interactions
async function handleMusicButton(interaction) {
    if (!interaction.isButton()) return false;
    
    const guildId = interaction.guild.id;
    const customId = interaction.customId;
    
    if (!customId.startsWith('music_') && !customId.startsWith('queue_')) return false;
    
    try {
        switch (customId) {
            case 'music_skip':
                await skipTrack(guildId, interaction);
                break;
            case 'music_pause':
                await pausePlayer(guildId, interaction);
                break;
            case 'music_stop':
                await stopPlayer(guildId, interaction);
                break;
            case 'music_queue':
                // Use the button-specific queue handler
                await handleQueueButton(interaction);
                break;
            case 'queue_prev':
            case 'queue_next':
                // Handle queue navigation buttons
                // This would be implemented separately
                await interaction.reply({
                    content: 'Queue navigation is not yet implemented',
                    ephemeral: true
                });
                break;
            default:
                await interaction.reply({
                    content: 'Unknown button interaction',
                    ephemeral: true
                });
        }
        
        return true;
    } catch (error) {
        console.error('[MUSIC] Error handling music button:', error);
        
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: `❌ There was an error: ${error.message}`,
                    ephemeral: true
                });
            } else {
                await interaction.followUp({
                    content: `❌ There was an error: ${error.message}`,
                    ephemeral: true
                });
            }
        } catch (followUpError) {
            console.error('[MUSIC] Error sending button error response:', followUpError);
        }
        
        return true;
    }
}

// Initialize the music system
function initMusicSystem(client) {
    // Set up interaction handlers for buttons
    client.on('interactionCreate', async (interaction) => {
        if (interaction.isButton() && interaction.customId.startsWith('music_')) {
            await handleMusicButton(interaction);
        }
    });
    
    console.log('[MUSIC] Music system initialized');
}

module.exports = {
    getMusicCommands,
    handleMusicCommand,
    initMusicSystem
};
