const { Client, GatewayIntentBits, Events, ActivityType } = require('discord.js');
require('dotenv').config();
const { registerCommands, handleCommandInteraction, clearCommands } = require('./Command/commandHandler');
const securitySystem = require('./Security/syshandling');
const loggingSystem = require('./Security/Logging');
const utilitySystem = require('./Utils/Function');
const { initializeInviteSystem, setupInviteListeners } = require('./Invitetracker/invitehanddling');
const { inviteCommands, handleInviteCommand } = require('./Invitetracker/Invite');
const musicSystem = require('./Music/musicsys');

// Import welcome and goodbye systems
const welcomeSystem = require('./Startup/Welcom');
const goodbyeSystem = require('./Startup/Goodbye');

// Create a new client instance with more comprehensive intents
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences
  ] 
});

// Function to check and display ping
function checkPing() {
  const ping = client.ws.ping;
  if (ping === -1) {
    console.log(`[PING CHECK] Establishing connection...`);
  } else {
    console.log(`[PING CHECK] Current latency: ${ping}ms`);
  }
}

// Error handling
client.on('error', error => {
  console.error('[ERROR]', error);
});

process.on('unhandledRejection', error => {
  console.error('[UNHANDLED REJECTION]', error);
});

// When the client is ready, run this code (only once)
client.once('ready', async () => {
  console.log(`[SYSTEM] Logged in as ${client.user.tag}!`);
  
  // Set the bot's presence to DND (Do Not Disturb) with custom status
  client.user.setPresence({
    status: 'dnd',
    activities: [{
      name: 'music & economy commands',
      type: ActivityType.Watching
    }]
  });
  
  // Initialize invite tracking system
  await initializeInviteSystem(client);
  setupInviteListeners(client);
  
  // Initialize music system
  musicSystem.initMusicSystem(client);
  
  // Register commands in the background, don't wait for completion
  console.log('[COMMANDS] Starting command registration in background...');
  
  // Log the bot's invite URL
  const botInviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
  console.log('[SYSTEM] Invite URL:', botInviteUrl);
  console.log('[SYSTEM] If commands are not showing up, try reinviting the bot using this URL');
  
  // Initial ping check
  checkPing();
  
  // Set up the interval to check ping every 30 seconds
  setInterval(checkPing, 30000);
  
  // Initialize utility systems (economy, games, shop)
  utilitySystem.initSystems(client);
  
  // Log all systems initialized at once
  console.log('[SYSTEM] All systems activated: Security, Logging, Verification, Welcome, Goodbye, Economy, Invite Tracking, Music');
  console.log('[SYSTEM] Bot is now fully operational!');
  
  // Start command registration in the background
  setTimeout(async () => {
    try {
      // Clear old commands first
      console.log('[COMMANDS] Clearing old commands...');
      await clearCommands(client.user.id).catch(error => {
        console.error('[ERROR] Failed to clear commands:', error);
      });
      
      // Get all command builders
      const utilityCommands = utilitySystem.getCommandBuilders();
      console.log(`[COMMANDS] Got ${utilityCommands.length} utility commands`);
      
      // Get music commands
      const musicCommands = musicSystem.getMusicCommands();
      console.log(`[COMMANDS] Got ${musicCommands.length} music commands: ${musicCommands.map(cmd => cmd.name).join(', ')}`);
      
      // Add invite commands and music commands to the registration
      const allCommands = [...utilityCommands, ...inviteCommands, ...musicCommands];
      console.log(`[COMMANDS] Total commands to register: ${allCommands.length}`);
      
      // Register slash commands
      console.log('[COMMANDS] Registering new commands...');
      const registrationResult = await registerCommands(client.user.id, allCommands).catch(error => {
        console.error('[ERROR] Failed to register commands:', error);
        return { error: true };
      });
      
      if (registrationResult && registrationResult.guildData) {
        console.log('[COMMANDS] Commands registered to test guild');
      } else if (registrationResult && !registrationResult.error) {
        console.log('[COMMANDS] Commands registered globally');
      }
      
      console.log('[SYSTEM] Command registration process completed');
    } catch (error) {
      console.error('[ERROR] Command registration process failed:', error);
    }
  }, 5000); // Wait 5 seconds before starting command registration
});

// Handle interaction events (slash commands, buttons, modals)
client.on(Events.InteractionCreate, async interaction => {
  try {
    // First, check if this is a verification-related interaction
    // (button click or modal submission)
    if (!interaction.isChatInputCommand()) {
      const handled = await securitySystem.handleInteraction(interaction);
      if (handled) return;
    }
    
    // Then, handle slash commands
    if (interaction.isChatInputCommand()) {
      console.log(`[COMMAND] /${interaction.commandName} triggered`);
      
      // Check if it's a music command
      if (interaction.commandName === 'music') {
        await musicSystem.handleMusicCommand(interaction);
        return;
      }
      
      // Check if it's an invite command
      if (interaction.commandName === 'invites' || interaction.commandName === 'invitecheck') {
        await handleInviteCommand(interaction);
        return;
      }
      
      // Check if it's an economy/utility command
      const utilityCommands = ['bizz', 'admin-bizz', 'shop', 'admin-shop', 'colors', 'coinflip', 'setup-economy'];
      if (utilityCommands.includes(interaction.commandName)) {
        await utilitySystem.handleCommand(client, interaction);
        return;
      }
      
      // Process other commands
      await handleCommandInteraction(interaction);
    }
  } catch (error) {
    console.error('[ERROR] Interaction handling failed:', error);
  }
});

// Handle message events for security checks
client.on(Events.MessageCreate, async message => {
  // Ignore messages from bots or non-guild messages
  if (message.author.bot || !message.guild) return;
  
  // Pass to security system for processing
  securitySystem.handleMessage(message);
});

// Handle member join events for anti-raid and welcome messages
client.on(Events.GuildMemberAdd, async member => {
  // Pass to security system for processing (anti-raid)
  securitySystem.handleMemberJoin(member);
  
  // Log the member join
  loggingSystem.handleMemberJoin(member);
  
  // Send welcome message
  welcomeSystem.sendWelcomeMessage(member);
});

// Handle member leave events and goodbye messages
client.on(Events.GuildMemberRemove, async member => {
  // Log the member leave
  loggingSystem.handleMemberLeave(member);
  
  // Send goodbye message
  goodbyeSystem.sendGoodbyeMessage(member);
});

// Handle message delete events
client.on(Events.MessageDelete, async message => {
  // Log the message deletion
  loggingSystem.handleMessageDelete(message);
});

// Handle message update events
client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  // Log the message update
  loggingSystem.handleMessageUpdate(oldMessage, newMessage);
});

// Handle channel create events
client.on(Events.ChannelCreate, async channel => {
  // Log the channel creation
  loggingSystem.handleChannelCreate(channel);
});

// Handle channel delete events
client.on(Events.ChannelDelete, async channel => {
  // Log the channel deletion
  loggingSystem.handleChannelDelete(channel);
});

// Handle member update events (roles, nickname, etc.)
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  // Log the member update
  loggingSystem.handleMemberUpdate(oldMember, newMember);
});

// Handle voice state update events (join/leave/move voice channels)
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  // Log the voice state update
  loggingSystem.handleVoiceStateUpdate(oldState, newState);
});

// Login to Discord with your client's token
console.log('[SYSTEM] Connecting to Discord...');
client.login(process.env.TOKEN)
  .then(() => console.log('[SYSTEM] Connection successful'))
  .catch(error => {
    console.error('[ERROR] Connection failed:', error);
    process.exit(1);
  });
