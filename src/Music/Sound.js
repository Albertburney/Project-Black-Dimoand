const fs = require('fs');
const path = require('path');
const { createAudioResource, StreamType } = require('@discordjs/voice');
const play = require('play-dl');
const yts = require('yt-search');
const { EmbedBuilder } = require('discord.js');

// Handles creating audio resources from various sources
class Sound {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Create an audio resource from a YouTube URL
     * @param {string} url The YouTube URL
     * @returns {Promise<Object>} Object with audio resource and track info
     */
    async createYouTubeResource(url) {
        try {
            console.log(`[MUSIC] Creating resource for YouTube URL: ${url}`);
            
            // Get video info
            const videoInfo = await play.video_info(url);
            const video = videoInfo.video_details;
            
            // Get stream with higher quality settings
            const stream = await play.stream(url, { 
                quality: 0, // 0 is highest audio quality
                discordPlayerCompatibility: true // Better compatibility with Discord
            });
            
            console.log(`[MUSIC] Stream type: ${stream.type}, Stream readable: ${stream.stream.readable}`);
            
            // Create audio resource with proper input type and higher volume
            const resource = createAudioResource(stream.stream, {
                inputType: stream.type,
                inlineVolume: true
            });
            
            // Set volume to 100%
            if (resource.volume) {
                resource.volume.setVolume(1);
            }
            
            return {
                resource,
                track: {
                    title: video.title,
                    url: video.url,
                    thumbnail: video.thumbnails[0].url,
                    duration: video.durationInSec,
                    author: video.channel?.name || 'Unknown',
                    type: 'youtube'
                }
            };
        } catch (error) {
            console.error('Error creating YouTube resource:', error);
            throw error;
        }
    }
    
    /**
     * Search for YouTube videos
     * @param {string} query The search query
     * @returns {Promise<Array>} Array of search results
     */
    async searchYouTube(query) {
        try {
            console.log(`[MUSIC] Searching YouTube for: ${query}`);
            const results = await yts(query);
            return results.videos.slice(0, 5); // Return top 5 results
        } catch (error) {
            console.error('Error searching YouTube:', error);
            throw error;
        }
    }
    
    /**
     * Create an audio resource from a search query
     * @param {string} query The search query
     * @returns {Promise<Object>} Object with audio resource and track info
     */
    async createFromSearch(query) {
        try {
            console.log(`[MUSIC] Creating resource from search: ${query}`);
            const results = await this.searchYouTube(query);
            
            if (results.length === 0) {
                throw new Error('No search results found');
            }
            
            const video = results[0];
            return await this.createYouTubeResource(video.url);
        } catch (error) {
            console.error('Error creating resource from search:', error);
            throw error;
        }
    }
    
    /**
     * Check if a string is a YouTube URL
     * @param {string} input The input to check
     * @returns {boolean} True if it's a YouTube URL
     */
    isYouTubeUrl(input) {
        return input.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/);
    }
    
    /**
     * Create an embed for the currently playing track
     * @param {Object} track The track object
     * @param {Object} options Additional options
     * @returns {EmbedBuilder} Discord embed
     */
    createNowPlayingEmbed(track, options = {}) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🎵 Now Playing')
            .setDescription(`**[${track.title}](${track.url})**`)
            .setThumbnail(track.thumbnail)
            .addFields(
                { name: '👤 Artist', value: track.author, inline: true },
                { name: '⏱️ Duration', value: this.formatDuration(track.duration), inline: true }
            )
            .setFooter({ text: `Requested by ${track.requestedBy || 'Unknown'}` });
        
        if (options.queuePosition && options.queueLength) {
            embed.addFields({ name: '📋 Queue Position', value: `${options.queuePosition}/${options.queueLength}`, inline: true });
        }
        
        return embed;
    }
    
    /**
     * Create an embed for the song queue
     * @param {Array} queue The queue of tracks
     * @param {number} page The page number
     * @param {number} pageSize The number of items per page
     * @returns {EmbedBuilder} Discord embed
     */
    createQueueEmbed(queue, page = 1, pageSize = 10) {
        const totalPages = Math.ceil(queue.length / pageSize);
        const startIndex = (page - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, queue.length);
        
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🎵 Music Queue');
        
        if (queue.length === 0) {
            embed.setDescription('The queue is empty. Use `/music play` to add songs');
            return embed;
        }
        
        embed.setDescription(`${queue.length} song${queue.length !== 1 ? 's' : ''} in queue`);
        
        let description = '';
        
        for (let i = startIndex; i < endIndex; i++) {
            const track = queue[i];
            description += `**${i + 1}.** [${track.title}](${track.url}) (${this.formatDuration(track.duration)}) - *Requested by: ${track.requestedBy || 'Unknown'}*\n`;
        }
        
        if (description) {
            embed.addFields({ name: 'Queue', value: description });
        }
        
        // Add current song info if available (first song in queue)
        if (queue.length > 0 && page === 1) {
            const currentTrack = queue[0];
            embed.addFields({ name: '🎵 Now Playing', value: `[${currentTrack.title}](${currentTrack.url}) (${this.formatDuration(currentTrack.duration)})` });
        }
        
        // Add queue duration
        const totalDuration = queue.reduce((total, track) => total + track.duration, 0);
        embed.addFields({ name: '⏱️ Total Duration', value: this.formatDuration(totalDuration) });
        
        embed.setFooter({ text: `Page ${page}/${totalPages || 1}` });
        
        return embed;
    }
    
    /**
     * Format duration in seconds to MM:SS format
     * @param {number} seconds Duration in seconds
     * @returns {string} Formatted duration
     */
    formatDuration(seconds) {
        if (!seconds) return '00:00';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

module.exports = new Sound();
