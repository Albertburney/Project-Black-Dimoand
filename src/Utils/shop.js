const fs = require('fs');
const path = require('path');
const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getUserBalance, removeCurrency, addCurrency } = require('./Currency');

// Define path for shop data
const DATA_DIR = path.join(__dirname, '../../data');
const SHOP_FILE = path.join(DATA_DIR, 'shop.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load shop data
function loadShopData() {
    try {
        if (fs.existsSync(SHOP_FILE)) {
            const data = fs.readFileSync(SHOP_FILE, 'utf8');
            return JSON.parse(data);
        } else {
            // Initial structure for shop data
            const initialData = {
                serverShops: {},
                userInventories: {},
                defaultItems: [
                    {
                        id: 'VIP_ROLE',
                        name: 'VIP Role',
                        description: 'Get a special VIP role in the server',
                        price: 10000,
                        icon: '👑',
                        type: 'role',
                        roleId: null,
                        limit: 1,
                        stock: -1 // Unlimited stock
                    },
                    {
                        id: 'CUSTOM_COLOR',
                        name: 'Custom Color Role',
                        description: 'Get a role with your chosen color',
                        price: 5000,
                        icon: '🎨',
                        type: 'customRole',
                        limit: 1,
                        stock: -1 // Unlimited stock
                    },
                    {
                        id: 'NAME_CHANGE',
                        name: 'Custom Nickname',
                        description: 'Change your nickname to anything you want',
                        price: 1000,
                        icon: '📝',
                        type: 'nickname',
                        limit: -1, // No limit on purchases
                        stock: -1 // Unlimited stock
                    },
                    {
                        id: 'SERVER_BOOST',
                        name: 'Server Booster Bonus',
                        description: 'Get 5000 Bizz for boosting the server',
                        price: 0,
                        icon: '🚀',
                        type: 'boosterReward',
                        limit: 1,
                        stock: -1 // Unlimited stock
                    }
                ],
                lastUpdated: new Date().toISOString()
            };
            saveShopData(initialData);
            return initialData;
        }
    } catch (error) {
        console.error('[SHOP] Error loading shop data:', error);
        return { 
            serverShops: {}, 
            userInventories: {},
            defaultItems: [],
            lastUpdated: new Date().toISOString() 
        };
    }
}

// Save shop data
function saveShopData(data) {
    try {
        data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(SHOP_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('[SHOP] Error saving shop data:', error);
        return false;
    }
}

// Initialize server shop if it doesn't exist
function initServerShop(guildId) {
    const data = loadShopData();
    
    if (!data.serverShops[guildId]) {
        data.serverShops[guildId] = {
            items: [],
            lastUpdated: new Date().toISOString()
        };
        saveShopData(data);
    }
    
    return data.serverShops[guildId];
}

// Get user inventory
function getUserInventory(userId) {
    const data = loadShopData();
    
    if (!data.userInventories[userId]) {
        data.userInventories[userId] = {
            items: [],
            lastUpdated: new Date().toISOString()
        };
        saveShopData(data);
    }
    
    return data.userInventories[userId].items;
}

// Add item to server shop
function addItemToShop(guildId, item) {
    const data = loadShopData();
    initServerShop(guildId);
    
    // Generate a unique ID if not provided
    if (!item.id) {
        item.id = `CUSTOM_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
    
    // Check if item already exists
    const existingItemIndex = data.serverShops[guildId].items.findIndex(i => i.id === item.id);
    
    if (existingItemIndex !== -1) {
        // Update existing item
        data.serverShops[guildId].items[existingItemIndex] = item;
    } else {
        // Add new item
        data.serverShops[guildId].items.push(item);
    }
    
    data.serverShops[guildId].lastUpdated = new Date().toISOString();
    return saveShopData(data);
}

// Remove item from server shop
function removeItemFromShop(guildId, itemId) {
    const data = loadShopData();
    initServerShop(guildId);
    
    const initialLength = data.serverShops[guildId].items.length;
    data.serverShops[guildId].items = data.serverShops[guildId].items.filter(item => item.id !== itemId);
    
    if (data.serverShops[guildId].items.length === initialLength) {
        // No item was removed
        return false;
    }
    
    data.serverShops[guildId].lastUpdated = new Date().toISOString();
    return saveShopData(data);
}

// Get all available items for a server
function getAvailableItems(guildId) {
    const data = loadShopData();
    initServerShop(guildId);
    
    // Combine default items and server-specific items
    const defaultItems = data.defaultItems || [];
    const serverItems = data.serverShops[guildId].items || [];
    
    return [...defaultItems, ...serverItems];
}

// Get specific item by ID
function getItemById(guildId, itemId) {
    const items = getAvailableItems(guildId);
    return items.find(item => item.id === itemId);
}

// Buy an item
function buyItem(guildId, userId, itemId) {
    const item = getItemById(guildId, itemId);
    
    if (!item) {
        return {
            success: false,
            message: 'Item not found in the shop.'
        };
    }
    
    // Check if item is in stock
    if (item.stock === 0) {
        return {
            success: false,
            message: 'This item is out of stock.'
        };
    }
    
    // Check user balance
    const balance = getUserBalance(userId);
    if (balance < item.price) {
        return {
            success: false,
            message: `You don't have enough Bizz. You need ${item.price} Bizz but have ${balance} Bizz.`
        };
    }
    
    // Check purchase limit
    if (item.limit > 0) {
        const inventory = getUserInventory(userId);
        const purchasedCount = inventory.filter(i => i.id === itemId).length;
        
        if (purchasedCount >= item.limit) {
            return {
                success: false,
                message: `You've reached the purchase limit for this item.`
            };
        }
    }
    
    // Deduct currency
    if (item.price > 0) {
        const deducted = removeCurrency(userId, item.price, `Purchased ${item.name}`);
        if (!deducted) {
            return {
                success: false,
                message: 'Failed to process the transaction. Please try again.'
            };
        }
    }
    
    // Add to user inventory
    const data = loadShopData();
    if (!data.userInventories[userId]) {
        data.userInventories[userId] = {
            items: [],
            lastUpdated: new Date().toISOString()
        };
    }
    
    const purchaseData = {
        ...item,
        purchasedAt: new Date().toISOString(),
        used: false
    };
    
    data.userInventories[userId].items.push(purchaseData);
    data.userInventories[userId].lastUpdated = new Date().toISOString();
    
    // Update stock if needed
    if (item.stock > 0) {
        const items = getAvailableItems(guildId);
        const itemIndex = items.findIndex(i => i.id === itemId);
        
        if (itemIndex !== -1) {
            if (items[itemIndex].stock !== -1) {
                items[itemIndex].stock--;
            }
            
            // Update default items or server shop items accordingly
            if (data.defaultItems.some(i => i.id === itemId)) {
                const defaultItemIndex = data.defaultItems.findIndex(i => i.id === itemId);
                data.defaultItems[defaultItemIndex].stock = items[itemIndex].stock;
            } else {
                const serverItemIndex = data.serverShops[guildId].items.findIndex(i => i.id === itemId);
                if (serverItemIndex !== -1) {
                    data.serverShops[guildId].items[serverItemIndex].stock = items[itemIndex].stock;
                }
            }
        }
    }
    
    saveShopData(data);
    
    return {
        success: true,
        message: `You've purchased ${item.name} for ${item.price} Bizz.`,
        item: purchaseData
    };
}

// Use an item
async function useItem(client, guildId, userId, itemId, interaction) {
    const data = loadShopData();
    
    if (!data.userInventories[userId]) {
        return {
            success: false,
            message: 'You have no items in your inventory.'
        };
    }
    
    // Find the specific item instance in user inventory
    const inventoryItemIndex = data.userInventories[userId].items.findIndex(i => i.id === itemId && !i.used);
    
    if (inventoryItemIndex === -1) {
        return {
            success: false,
            message: 'Item not found in your inventory or already used.'
        };
    }
    
    const item = data.userInventories[userId].items[inventoryItemIndex];
    
    // Handle different item types
    switch (item.type) {
        case 'role':
            try {
                const guild = client.guilds.cache.get(guildId);
                if (!guild) throw new Error('Guild not found');
                
                const member = await guild.members.fetch(userId);
                if (!member) throw new Error('Member not found');
                
                // If roleId is not set, use the first default role
                if (!item.roleId) {
                    return {
                        success: false,
                        message: 'Role not configured. Please ask an admin to set up the role.'
                    };
                }
                
                await member.roles.add(item.roleId);
                
                // Mark item as used
                data.userInventories[userId].items[inventoryItemIndex].used = true;
                data.userInventories[userId].items[inventoryItemIndex].usedAt = new Date().toISOString();
                saveShopData(data);
                
                return {
                    success: true,
                    message: `You've been given the ${item.name} role!`
                };
            } catch (error) {
                console.error('[SHOP] Error giving role:', error);
                return {
                    success: false,
                    message: 'Failed to give the role. Please contact an administrator.'
                };
            }
            
        case 'customRole':
            // This requires user input, handle separately
            try {
                // Mark item as used - will be handled in the interaction
                data.userInventories[userId].items[inventoryItemIndex].used = true;
                data.userInventories[userId].items[inventoryItemIndex].usedAt = new Date().toISOString();
                saveShopData(data);
                
                // The actual role creation will happen in the interaction handler
                return {
                    success: true,
                    message: 'Please follow the prompts to create your custom role.',
                    requiresInput: true,
                    inputType: 'customRole'
                };
            } catch (error) {
                console.error('[SHOP] Error setting up custom role:', error);
                return {
                    success: false,
                    message: 'Failed to set up custom role. Please try again.'
                };
            }
            
        case 'nickname':
            // This requires user input, handle separately
            try {
                // Mark item as used - will be handled in the interaction  
                data.userInventories[userId].items[inventoryItemIndex].used = true;
                data.userInventories[userId].items[inventoryItemIndex].usedAt = new Date().toISOString();
                saveShopData(data);
                
                // The actual nickname change will happen in the interaction handler
                return {
                    success: true,
                    message: 'Please follow the prompts to set your new nickname.',
                    requiresInput: true,
                    inputType: 'nickname'
                };
            } catch (error) {
                console.error('[SHOP] Error setting up nickname change:', error);
                return {
                    success: false,
                    message: 'Failed to set up nickname change. Please try again.'
                };
            }
            
        case 'boosterReward':
            try {
                const guild = client.guilds.cache.get(guildId);
                if (!guild) throw new Error('Guild not found');
                
                const member = await guild.members.fetch(userId);
                if (!member) throw new Error('Member not found');
                
                // Check if user is a booster
                if (!member.premiumSince) {
                    return {
                        success: false,
                        message: 'You need to boost the server to claim this reward.'
                    };
                }
                
                // Add currency bonus
                const amount = 5000; // Default booster bonus
                addCurrency(userId, amount, 'Server booster reward');
                
                // Mark item as used
                data.userInventories[userId].items[inventoryItemIndex].used = true;
                data.userInventories[userId].items[inventoryItemIndex].usedAt = new Date().toISOString();
                saveShopData(data);
                
                return {
                    success: true,
                    message: `Thanks for boosting! You've received ${amount} Bizz as a reward.`
                };
            } catch (error) {
                console.error('[SHOP] Error giving booster reward:', error);
                return {
                    success: false,
                    message: 'Failed to give booster reward. Please contact an administrator.'
                };
            }
            
        default:
            // Generic item with no specific action
            data.userInventories[userId].items[inventoryItemIndex].used = true;
            data.userInventories[userId].items[inventoryItemIndex].usedAt = new Date().toISOString();
            saveShopData(data);
            
            return {
                success: true,
                message: `You've used ${item.name}.`
            };
    }
}

// Define slash commands for shop system
const shopCommands = [
    new SlashCommandBuilder()
        .setName('shop')
        .setDescription('View and purchase items from the server shop')
        .addSubcommand(subcommand =>
            subcommand.setName('view')
                .setDescription('Browse items in the shop'))
        .addSubcommand(subcommand =>
            subcommand.setName('buy')
                .setDescription('Buy an item from the shop')
                .addStringOption(option =>
                    option.setName('item')
                        .setDescription('The ID of the item to buy')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('inventory')
                .setDescription('View your purchased items'))
        .addSubcommand(subcommand =>
            subcommand.setName('use')
                .setDescription('Use an item from your inventory')
                .addStringOption(option =>
                    option.setName('item')
                        .setDescription('The ID of the item to use')
                        .setRequired(true))),
    
    new SlashCommandBuilder()
        .setName('admin-shop')
        .setDescription('Manage the server shop')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName('add')
                .setDescription('Add a new item to the shop')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the item')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Description of the item')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('price')
                        .setDescription('Price in Bizz')
                        .setRequired(true)
                        .setMinValue(0))
                .addStringOption(option =>
                    option.setName('icon')
                        .setDescription('Emoji icon for the item')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Type of item')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Generic Item', value: 'generic' },
                            { name: 'Role', value: 'role' },
                            { name: 'Custom Role', value: 'customRole' },
                            { name: 'Nickname', value: 'nickname' }
                        ))
                .addStringOption(option =>
                    option.setName('role_id')
                        .setDescription('Role ID (only for role items)'))
                .addIntegerOption(option =>
                    option.setName('limit')
                        .setDescription('Purchase limit per user (0 for unlimited)')
                        .setMinValue(0))
                .addIntegerOption(option =>
                    option.setName('stock')
                        .setDescription('Total stock available (0 for sold out, -1 for unlimited)')
                        .setMinValue(-1)))
        .addSubcommand(subcommand =>
            subcommand.setName('remove')
                .setDescription('Remove an item from the shop')
                .addStringOption(option =>
                    option.setName('item')
                        .setDescription('The ID of the item to remove')
                        .setRequired(true)))
];

// Handle shop command execution
async function executeCommand(client, interaction) {
    const { commandName, options, user, guildId } = interaction;
    
    if (commandName === 'shop') {
        const subcommand = options.getSubcommand();
        
        if (subcommand === 'view') {
            const items = getAvailableItems(guildId);
            
            if (items.length === 0) {
                return interaction.reply({
                    content: 'There are no items available in the shop yet.',
                    ephemeral: true
                });
            }
            
            // Create shop embed
            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('🛒 Server Shop')
                .setDescription('Browse and purchase items with your Bizz')
                .setFooter({ text: `You have ${getUserBalance(user.id).toLocaleString()} Bizz` })
                .setTimestamp();
                
            // Group items by type
            const groupedItems = {
                'Roles & Perks': items.filter(item => ['role', 'customRole'].includes(item.type)),
                'Customization': items.filter(item => ['nickname'].includes(item.type)),
                'Other Items': items.filter(item => !['role', 'customRole', 'nickname'].includes(item.type))
            };
            
            // Add fields for each group
            Object.entries(groupedItems).forEach(([group, itemList]) => {
                if (itemList.length > 0) {
                    let itemText = '';
                    
                    itemList.forEach(item => {
                        const stockText = item.stock === -1 
                            ? 'Unlimited' 
                            : item.stock === 0 
                                ? 'Out of stock' 
                                : `${item.stock} left`;
                                
                        const limitText = item.limit === -1 
                            ? '' 
                            : ` (Limit: ${item.limit} per user)`;
                            
                        itemText += `${item.icon} **${item.name}** - ${item.price.toLocaleString()} Bizz\n`;
                        itemText += `→ ${item.description}\n`;
                        itemText += `→ Stock: ${stockText}${limitText}\n`;
                        itemText += `→ ID: \`${item.id}\`\n\n`;
                    });
                    
                    embed.addFields({ name: group, value: itemText });
                }
            });
            
            embed.addFields({ 
                name: 'How to buy', 
                value: 'Use `/shop buy item:ITEM_ID` to purchase an item.' 
            });
            
            return interaction.reply({ embeds: [embed] });
        }
        
        else if (subcommand === 'buy') {
            const itemId = options.getString('item');
            
            const result = buyItem(guildId, user.id, itemId);
            
            if (result.success) {
                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Purchase Successful')
                    .setDescription(result.message)
                    .addFields(
                        { name: 'Item', value: result.item.name },
                        { name: 'Price', value: `${result.item.price.toLocaleString()} Bizz` },
                        { name: 'Current Balance', value: `${getUserBalance(user.id).toLocaleString()} Bizz` }
                    )
                    .setFooter({ text: 'Use /shop inventory to view your items' })
                    .setTimestamp();
                    
                return interaction.reply({ embeds: [embed] });
            } else {
                return interaction.reply({
                    content: `❌ ${result.message}`,
                    ephemeral: true
                });
            }
        }
        
        else if (subcommand === 'inventory') {
            const inventory = getUserInventory(user.id);
            
            if (inventory.length === 0) {
                return interaction.reply({
                    content: 'You don\'t have any items in your inventory yet. Use `/shop view` to browse the shop!',
                    ephemeral: true
                });
            }
            
            // Group items by used status
            const availableItems = inventory.filter(item => !item.used);
            const usedItems = inventory.filter(item => item.used);
            
            // Create inventory embed
            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('🎒 Your Inventory')
                .setThumbnail(user.displayAvatarURL())
                .setFooter({ text: `You have ${getUserBalance(user.id).toLocaleString()} Bizz` })
                .setTimestamp();
                
            // Add available items
            if (availableItems.length > 0) {
                let itemText = '';
                
                availableItems.forEach(item => {
                    const purchaseDate = new Date(item.purchasedAt).toLocaleDateString();
                    itemText += `${item.icon} **${item.name}**\n`;
                    itemText += `→ ${item.description}\n`;
                    itemText += `→ Purchased: ${purchaseDate}\n`;
                    itemText += `→ ID: \`${item.id}\`\n\n`;
                });
                
                embed.addFields({ name: '📦 Available Items', value: itemText });
            }
            
            // Add used items (show up to 5 most recent)
            if (usedItems.length > 0) {
                let itemText = '';
                
                // Sort by used date (most recent first) and take up to 5
                const recentUsedItems = usedItems
                    .sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt))
                    .slice(0, 5);
                
                recentUsedItems.forEach(item => {
                    const usedDate = new Date(item.usedAt).toLocaleDateString();
                    itemText += `${item.icon} **${item.name}** - Used on ${usedDate}\n`;
                });
                
                if (usedItems.length > 5) {
                    itemText += `\n*And ${usedItems.length - 5} more used items...*`;
                }
                
                embed.addFields({ name: '✅ Used Items', value: itemText });
            }
            
            embed.addFields({ 
                name: 'How to use items', 
                value: 'Use `/shop use item:ITEM_ID` to use an available item.' 
            });
            
            return interaction.reply({ embeds: [embed] });
        }
        
        else if (subcommand === 'use') {
            const itemId = options.getString('item');
            
            const result = await useItem(client, guildId, user.id, itemId, interaction);
            
            if (result.success) {
                if (result.requiresInput) {
                    // Handle items that need additional input
                    if (result.inputType === 'customRole') {
                        // Wait for color input
                        await interaction.reply({
                            content: 'Please enter the hexadecimal color code for your custom role (e.g., #FF0000 for red):',
                            ephemeral: true
                        });
                        
                        // Rest of the logic will be handled by the message collector in the handler
                    } else if (result.inputType === 'nickname') {
                        // Wait for nickname input
                        await interaction.reply({
                            content: 'Please enter your desired nickname:',
                            ephemeral: true
                        });
                        
                        // Rest of the logic will be handled by the message collector in the handler
                    } else {
                        await interaction.reply({
                            content: result.message,
                            ephemeral: true
                        });
                    }
                } else {
                    const embed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('✅ Item Used')
                        .setDescription(result.message)
                        .setTimestamp();
                        
                    await interaction.reply({ embeds: [embed] });
                }
            } else {
                await interaction.reply({
                    content: `❌ ${result.message}`,
                    ephemeral: true
                });
            }
        }
    }
    
    else if (commandName === 'admin-shop') {
        const subcommand = options.getSubcommand();
        
        if (subcommand === 'add') {
            const name = options.getString('name');
            const description = options.getString('description');
            const price = options.getInteger('price');
            const icon = options.getString('icon');
            const type = options.getString('type');
            const roleId = options.getString('role_id');
            const limit = options.getInteger('limit') ?? 1;
            const stock = options.getInteger('stock') ?? -1;
            
            // Create new item
            const newItem = {
                id: `${type.toUpperCase()}_${Date.now()}`,
                name,
                description,
                price,
                icon,
                type,
                limit,
                stock
            };
            
            // Add role ID if provided
            if (roleId && type === 'role') {
                newItem.roleId = roleId;
            }
            
            // Add to shop
            const added = addItemToShop(guildId, newItem);
            
            if (added) {
                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Item Added to Shop')
                    .setDescription(`Successfully added **${name}** to the shop.`)
                    .addFields(
                        { name: 'Name', value: name },
                        { name: 'Price', value: `${price.toLocaleString()} Bizz` },
                        { name: 'Type', value: type },
                        { name: 'Item ID', value: newItem.id }
                    )
                    .setTimestamp();
                    
                return interaction.reply({ embeds: [embed] });
            } else {
                return interaction.reply({
                    content: '❌ Failed to add item to the shop. Please try again.',
                    ephemeral: true
                });
            }
        }
        
        else if (subcommand === 'remove') {
            const itemId = options.getString('item');
            
            // Remove from shop
            const removed = removeItemFromShop(guildId, itemId);
            
            if (removed) {
                return interaction.reply({
                    content: `✅ Successfully removed item \`${itemId}\` from the shop.`
                });
            } else {
                return interaction.reply({
                    content: `❌ Item \`${itemId}\` not found in the shop.`,
                    ephemeral: true
                });
            }
        }
    }
}

// Export functions and commands
module.exports = {
    shopCommands,
    executeCommand,
    initServerShop,
    addItemToShop,
    removeItemFromShop,
    getAvailableItems,
    getUserInventory,
    buyItem,
    useItem
};
