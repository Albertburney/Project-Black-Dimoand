# Black Diamond Bot Dashboard

This is the web dashboard for the Black Diamond Discord bot, allowing server owners and administrators to configure the bot, view statistics, and manage various features.

## Features

- **Server Management**: Configure the bot for each server
- **Logging**: Set up and monitor logging channels
- **Music Controls**: Control the music player from the web
- **Economy Settings**: Manage the economy system
- **Security Configuration**: Set up anti-raid, anti-spam and other protection measures
- **Invite Tracking**: Monitor and configure invite rewards
- **Admin Panel**: For bot owners to monitor bot performance and health

## Getting Started

### Prerequisites

- Node.js 16.0.0 or higher
- npm or yarn package manager
- A Discord application with OAuth2 setup

### Installation

1. Clone this repository or copy the `App` folder to your project

2. Navigate to the App directory:
   ```
   cd App
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Set up environment variables by creating a `.env` file with the following variables:
   ```
   CLIENT_ID=your_discord_application_id
   CLIENT_SECRET=your_discord_client_secret
   CALLBACK_URL=http://localhost:3000/auth/discord/callback
   OWNER_ID=your_discord_user_id
   SESSION_SECRET=a_random_secret_string
   DASHBOARD_PORT=3000
   ```

5. Start the dashboard:
   ```
   npm start
   ```

### Development Mode

For development with automatic reloading:
```
npm run dev
```

## Dashboard Pages

- **Dashboard (`/`)**: Overview of bot statistics
- **Servers (`/servers.html`)**: Manage servers where the bot is present
- **Music (`/music.html`)**: Control music playback
- **Economy (`/economy.html`)**: Configure economy settings
- **Security (`/security.html`)**: Set up protection features
- **Logging (`/logging.html`)**: Configure logging settings
- **Invites (`/invites.html`)**: Manage invite tracking
- **Settings (`/settings.html`)**: General bot settings

## Admin Panel

The admin panel is a special section only accessible to the bot owner, providing detailed statistics, logs, and administrative controls.

- **URL**: `/admin`
- **Access**: Only the Discord user specified in the `OWNER_ID` environment variable has access

## Folder Structure

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

## Integration with the Bot

The dashboard is designed to interact with your Discord bot. In a production environment, you would need to:

1. Create API endpoints in your bot to fetch data and modify settings
2. Update the API routes in the dashboard to communicate with your bot
3. Implement proper authentication and authorization

## Running in Production

For a production deployment:

1. Set up proper HTTPS with a certificate
2. Update the `CALLBACK_URL` to your production URL
3. Consider using a process manager like PM2
4. Set up proper logging and monitoring

## License

This project is licensed under the MIT License - see the LICENSE file for details 