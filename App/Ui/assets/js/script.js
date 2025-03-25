/**
 * Black Diamond Bot Dashboard - Main JavaScript
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all interactive elements
    initSidebar();
    initThemeToggle();
    initNotifications();
    initTooltips();
    
    // Add event listeners for specific page elements
    addPageSpecificListeners();
});

/**
 * Initialize responsive sidebar behavior
 */
function initSidebar() {
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            document.querySelector('.dashboard').classList.toggle('sidebar-collapsed');
        });
    }
    
    // Collapse sidebar on smaller screens
    function checkWindowSize() {
        if (window.innerWidth < 768) {
            document.querySelector('.dashboard')?.classList.add('sidebar-collapsed');
        } else {
            document.querySelector('.dashboard')?.classList.remove('sidebar-collapsed');
        }
    }
    
    // Check on load and resize
    checkWindowSize();
    window.addEventListener('resize', checkWindowSize);
}

/**
 * Initialize theme toggle functionality
 */
function initThemeToggle() {
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            document.body.classList.toggle('dark-theme');
            document.body.classList.toggle('light-theme');
            
            // Save preference
            const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
            localStorage.setItem('dashboard-theme', currentTheme);
        });
    }
    
    // Load saved theme preference
    const savedTheme = localStorage.getItem('dashboard-theme');
    if (savedTheme) {
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            document.body.classList.remove('light-theme');
        } else {
            document.body.classList.add('light-theme');
            document.body.classList.remove('dark-theme');
        }
    }
}

/**
 * Initialize notification functionality
 */
function initNotifications() {
    const notificationIcon = document.querySelector('.notifications');
    if (notificationIcon) {
        notificationIcon.addEventListener('click', function() {
            // Toggle notification panel
            console.log('Notification panel would be toggled here');
        });
    }
    
    // Example function to show a notification
    window.showNotification = function(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">${message}</div>
            <button class="notification-close"><i class="fas fa-times"></i></button>
        `;
        
        const notificationsContainer = document.querySelector('.notifications-container') || createNotificationsContainer();
        notificationsContainer.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.classList.add('notification-hiding');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 5000);
        
        // Add close button functionality
        notification.querySelector('.notification-close').addEventListener('click', function() {
            notification.classList.add('notification-hiding');
            setTimeout(() => {
                notification.remove();
            }, 300);
        });
    }
    
    function createNotificationsContainer() {
        const container = document.createElement('div');
        container.className = 'notifications-container';
        document.body.appendChild(container);
        return container;
    }
}

/**
 * Initialize tooltips
 */
function initTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            const tooltipText = this.getAttribute('data-tooltip');
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = tooltipText;
            document.body.appendChild(tooltip);
            
            // Position tooltip
            const rect = this.getBoundingClientRect();
            tooltip.style.top = `${rect.bottom + 10}px`;
            tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2)}px`;
            
            // Store reference to the tooltip
            this.tooltip = tooltip;
        });
        
        element.addEventListener('mouseleave', function() {
            if (this.tooltip) {
                this.tooltip.remove();
                this.tooltip = null;
            }
        });
    });
}

/**
 * Add event listeners specific to the current page
 */
function addPageSpecificListeners() {
    // Get current page from URL
    const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
    
    switch (currentPage) {
        case 'security':
            initSecurityPage();
            break;
        case 'logging':
            initLoggingPage();
            break;
        case 'invites':
            initInvitesPage();
            break;
        case 'admin-panel':
            initAdminPanel();
            break;
        case 'music':
            initMusicPage();
            break;
        case '':
        case 'index':
            initDashboardPage();
            break;
    }
}

/**
 * Initialize security page functionality
 */
function initSecurityPage() {
    // Protection level sliders
    const sliders = document.querySelectorAll('.level-slider');
    sliders.forEach(slider => {
        slider.addEventListener('input', function() {
            updateProtectionLevel(this);
        });
        
        // Initialize on page load
        updateProtectionLevel(slider);
    });
    
    function updateProtectionLevel(slider) {
        const value = slider.value;
        const labels = slider.parentElement.querySelectorAll('.slider-labels span');
        
        labels.forEach((label, index) => {
            if (index + 1 == value) {
                label.classList.add('active');
            } else {
                label.classList.remove('active');
            }
        });
    }
}

/**
 * Initialize logging page functionality
 */
function initLoggingPage() {
    // Filter functionality for logs
    const logFilter = document.querySelector('.filter-control');
    if (logFilter) {
        logFilter.addEventListener('change', function() {
            filterLogs(this.value);
        });
    }
    
    function filterLogs(filterType) {
        const logEntries = document.querySelectorAll('.log-entry');
        
        logEntries.forEach(entry => {
            const entryType = entry.querySelector('.log-type').classList[1];
            
            if (filterType === 'all events' || filterType.includes(entryType)) {
                entry.style.display = 'flex';
            } else {
                entry.style.display = 'none';
            }
        });
    }
}

/**
 * Initialize admin panel functionality
 */
function initAdminPanel() {
    // Graph tabs
    const graphTabs = document.querySelectorAll('.graph-tab');
    graphTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            graphTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Would load different time period data
            console.log(`Switched to ${this.textContent.trim()} view`);
        });
    });
    
    // Admin actions
    const actionCards = document.querySelectorAll('.action-card');
    actionCards.forEach(card => {
        card.addEventListener('click', function() {
            const actionTitle = this.querySelector('.action-title').textContent;
            
            // Confirm action
            if (confirm(`Are you sure you want to ${actionTitle.toLowerCase()}?`)) {
                simulateAction(this, actionTitle);
            }
        });
    });
    
    function simulateAction(element, action) {
        element.style.opacity = '0.5';
        
        // Simulate processing time
        setTimeout(() => {
            element.style.opacity = '1';
            showNotification(`${action} completed successfully!`, 'success');
        }, 1500);
    }
}

/**
 * Initialize invites page functionality
 */
function initInvitesPage() {
    // Toggle for rewards system
    const rewardsToggle = document.querySelector('.reward-card .toggle-switch input');
    if (rewardsToggle) {
        rewardsToggle.addEventListener('change', function() {
            const rewardsGrid = document.querySelector('.rewards-grid');
            if (this.checked) {
                rewardsGrid.style.opacity = '1';
                rewardsGrid.style.pointerEvents = 'auto';
            } else {
                rewardsGrid.style.opacity = '0.5';
                rewardsGrid.style.pointerEvents = 'none';
            }
        });
    }
    
    // Threshold card interaction
    const thresholdCards = document.querySelectorAll('.threshold-card:not(:last-child)');
    thresholdCards.forEach(card => {
        card.addEventListener('click', function() {
            thresholdCards.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

/**
 * Initialize music page functionality
 */
function initMusicPage() {
    // Example: Update player state
    const playButton = document.querySelector('.player-control.play');
    if (playButton) {
        playButton.addEventListener('click', function() {
            const isPlaying = this.classList.contains('playing');
            
            if (isPlaying) {
                this.innerHTML = '<i class="fas fa-play"></i>';
                this.classList.remove('playing');
                // Would pause music
            } else {
                this.innerHTML = '<i class="fas fa-pause"></i>';
                this.classList.add('playing');
                // Would play music
            }
        });
    }
}

/**
 * Initialize main dashboard page functionality
 */
function initDashboardPage() {
    // Example: Server selection
    const serverSelect = document.querySelector('.server-select');
    if (serverSelect) {
        serverSelect.addEventListener('change', function() {
            console.log(`Loading data for server: ${this.value}`);
            // Would load server-specific data
        });
    }
} 