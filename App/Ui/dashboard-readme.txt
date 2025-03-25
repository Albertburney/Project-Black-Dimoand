# Black Diamond Bot Dashboard

This dashboard consists of two main sections:

## 1. Server Owner Dashboard
These pages are accessible to users who invite the bot to their servers:
- index.html - Main dashboard with server statistics
- servers.html - Server management
- music.html - Music player and controls
- economy.html - Economy settings and stats
- security.html - Security settings
- logging.html - Logging configuration
- invites.html - Invite tracking
- settings.html - Bot configuration

## 2. Bot Owner Admin Panel
This is a special panel (admin-panel.html) accessible only to you as the bot owner that includes:
- Real-time CPU and RAM usage monitoring
- Server count and active user statistics
- Shard status information
- System health metrics
- Administrative actions (restart bot, clear cache, etc.)

## File Structure
All dashboard files are organized in the following structure:

```
App/
├── Ui/              # Frontend files
│   ├── index.html   # Main dashboard entry point
│   ├── admin-panel.html # Bot owner admin panel
│   ├── security.html
│   ├── logging.html
│   ├── invites.html
│   ├── economy.html
│   ├── music.html
│   ├── servers.html
│   ├── settings.html
│   ├── assets/      # Static assets
│   │   ├── images/
│   │   ├── js/
│   │   └── css/
│   └── styles.css   # Main stylesheet
├── Server/          # Backend files
│   ├── server.js    # Express server for the dashboard
│   ├── middleware/
│   ├── routes/
│   └── api/         # API endpoints
└── Config/          # Configuration files
    └── dashboard.js

```

## How to Run the Dashboard

### Setting Up for First Use:
1. Make sure Node.js is installed on your system
2. Navigate to the App directory
3. Run `npm install` to install dependencies

### Starting the Dashboard:
1. To start the dashboard server, run:
   ```
   node App/Server/server.js
   ```
2. The dashboard will be available at:
   - http://localhost:3000/ (Main dashboard for server owners)
   - http://localhost:3000/admin (Admin panel for bot owner)

### Access Control:
- The regular dashboard requires Discord OAuth2 authentication
- The admin panel requires additional authentication with your bot owner credentials

### Development Notes:
- Currently, these are HTML mockups that need to be integrated with the backend
- To view any page statically for development, simply open the HTML files directly in a browser
- The main entry point is `index.html` for the server owner dashboard
- For the admin panel, use `admin-panel.html`

Note: All pages are frontend-only at this stage. Backend integration will be required to connect these interfaces to the actual bot functionality.

---

Dashboard created by Tushar A Burney, 2023 