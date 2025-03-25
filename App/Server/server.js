/**
 * Black Diamond Bot Dashboard Server
 * 
 * This Express server serves the dashboard and admin panel,
 * and provides API endpoints for interfacing with the bot.
 */

const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
require('dotenv').config();

// Import middleware
const { isAuthenticated, isOwner } = require('./middleware/auth');
const { logRequest } = require('./middleware/logging');

// Import routes
const apiRoutes = require('./routes/api');

// Create Express app
const app = express();
const PORT = process.env.DASHBOARD_PORT || 3000;

// Configure session
app.use(session({
    secret: process.env.SESSION_SECRET || 'black-diamond-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 86400000 } // 1 day
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Configure Discord authentication strategy
passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL || 'http://localhost:3000/auth/discord/callback',
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    // Store user in session
    return done(null, profile);
}));

// Serialize and deserialize user
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logRequest);

// Serve static files
app.use(express.static(path.join(__dirname, '../Ui')));

// Auth routes
app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/discord/callback', 
    passport.authenticate('discord', { 
        failureRedirect: '/login-failed' 
    }), 
    (req, res) => {
        res.redirect('/');
    }
);

app.get('/auth/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

// API routes
app.use('/api', apiRoutes);

// Admin routes - protected by isOwner middleware
app.get('/admin*', isOwner, (req, res) => {
    res.sendFile(path.join(__dirname, '../Ui/admin-panel.html'));
});

// Dashboard routes - protected by isAuthenticated middleware
app.get('/dashboard*', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../Ui/index.html'));
});

// Serve index for the root path
app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/dashboard');
    } else {
        res.sendFile(path.join(__dirname, '../Ui/login.html'));
    }
});

// Route for all other dashboard pages
app.get('/:page.html', isAuthenticated, (req, res) => {
    const page = req.params.page;
    const allowedPages = ['index', 'servers', 'music', 'economy', 'security', 'logging', 'invites', 'settings'];
    
    if (allowedPages.includes(page)) {
        res.sendFile(path.join(__dirname, `../Ui/${page}.html`));
    } else {
        res.status(404).send('Page not found');
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../Ui/404.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).sendFile(path.join(__dirname, '../Ui/500.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`[DASHBOARD] Server running on http://localhost:${PORT}`);
}); 