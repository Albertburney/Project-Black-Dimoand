# Black Diamond Discord Bot

Black Diamond is a feature-rich Discord bot with various functionalities to enhance your server experience.

## Features

- **Security System**: Anti-raid, anti-links, verification, and comprehensive logging
- **Invite Tracking**: Monitor and manage invite usage in your server
- **Economy System**: Currency management, shop, and games
- **Welcome & Goodbye**: Customizable messages for users joining or leaving
- **Music System**: Full-featured music player with YouTube support

## Music System Commands

The music system allows users to play music from YouTube in voice channels:

- `/music play <url or search>`: Play a song from YouTube
- `/music skip`: Skip the current song
- `/music pause`: Pause/resume the current song
- `/music stop`: Stop playback and clear the queue
- `/music queue`: View the current song queue
- `/music shuffle`: Shuffle the songs in the queue
- `/music remove <position>`: Remove a song from the queue
- `/music join`: Join your voice channel
- `/music leave`: Leave the voice channel
- `/music nowplaying`: Show the currently playing song
- `/music help`: Get help with music commands

## Setup

1. Create a `.env` file with your Discord bot token and Guild ID
2. Install dependencies with `npm install`
3. Start the bot with `npm start`

## Requirements

- Node.js v16.9.0 or higher
- Discord.js v14
- FFmpeg (included via ffmpeg-static package)

## License

This project is licensed under the MIT License - see the `Mit.md` file for details.
