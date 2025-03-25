# Black Diamond Bot Dashboard

A streamlined web interface for managing the Black Diamond Discord bot.

## Key Features

- **Server Management**: Configure bot settings for each server
- **Security & Logging**: Set up protection features and logging channels
- **Music & Economy**: Control music player and economy system
- **Invite Tracking**: Monitor invites and set up rewards

## Setup

1. Install: `npm install` in the App directory
2. Configure: Create `.env` file with Discord OAuth2 credentials
3. Run: `npm start` or `npm run dev` for development mode

## Access Points

- **Dashboard**: http://localhost:3000/
- **Admin Panel**: http://localhost:3000/admin (owner only)

## File Structure

```
App/
├── Ui/              # Frontend HTML/CSS/JS
├── Server/          # Express server backend
├── Config/          # Configuration files
└── package.json     # Dependencies
```

## Connection to Bot

The dashboard connects to the bot through API endpoints. Enable these in your bot configuration to ensure proper functionality.

## Production Notes

For production deployment:
- Set up HTTPS with a certificate
- Update callback URL in Discord developer portal
- Use a process manager like PM2

## License

MIT License - See the LICENSE file for details

---

**Developer Note:** This dashboard was created by Tushar A Burney. For inquiries or support, please reach out through Discord. 