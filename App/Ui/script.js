// Dashboard JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initialized');

    // Simulate loading data
    simulateDataLoading();

    // Setup event listeners
    setupEventListeners();

    // Initialize animations
    initializeAnimations();
});

// Function to simulate loading data
function simulateDataLoading() {
    // Show loading indicator for stats
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        const statInfo = card.querySelector('.stat-info h3');
        const originalValue = statInfo.textContent;
        statInfo.textContent = 'Loading...';
        
        // Simulate API call delay
        setTimeout(() => {
            statInfo.textContent = originalValue;
            card.classList.add('loaded');
        }, 1000);
    });

    // Simulate chart data loading
    const chart = document.querySelector('.chart-placeholder');
    if (chart) {
        chart.style.opacity = '0.5';
        setTimeout(() => {
            chart.style.opacity = '1';
            
            // Animate bars
            const bars = chart.querySelectorAll('.bar');
            bars.forEach((bar, index) => {
                setTimeout(() => {
                    bar.style.height = bar.style.height;
                }, 100 * index);
            });
        }, 1500);
    }
}

// Function to setup event listeners
function setupEventListeners() {
    // Navigation links
    const navLinks = document.querySelectorAll('.nav-links li');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            // Add active class to clicked link
            this.classList.add('active');
            
            // In a real app, this would navigate to different views
            simulatePageChange(this.querySelector('a').textContent.trim());
        });
    });

    // Add to Server button
    const addServerBtn = document.querySelector('.btn-primary');
    if (addServerBtn) {
        addServerBtn.addEventListener('click', function() {
            alert('This would open the bot invite URL in a real implementation.');
        });
    }

    // Search functionality
    const searchInput = document.querySelector('.search-bar input');
    if (searchInput) {
        searchInput.addEventListener('keyup', function(e) {
            if (e.key === 'Enter') {
                alert(`You searched for: ${this.value}`);
                this.value = '';
            }
        });
    }

    // Notification bell
    const notificationBell = document.querySelector('.notifications');
    if (notificationBell) {
        notificationBell.addEventListener('click', function() {
            alert('You would see your notifications here in a real implementation.');
        });
    }

    // Help button
    const helpButton = document.querySelector('.help');
    if (helpButton) {
        helpButton.addEventListener('click', function() {
            alert('This would show a help dialog in a real implementation.');
        });
    }

    // Time period selector for chart
    const timeSelector = document.querySelector('.section-actions select');
    if (timeSelector) {
        timeSelector.addEventListener('change', function() {
            const selectedPeriod = this.value;
            alert(`You selected to view data for: ${selectedPeriod}`);
            
            // Simulate chart refresh
            const chart = document.querySelector('.chart-placeholder');
            if (chart) {
                chart.style.opacity = '0.5';
                setTimeout(() => {
                    chart.style.opacity = '1';
                    
                    // Randomize bar heights
                    const bars = chart.querySelectorAll('.bar');
                    bars.forEach(bar => {
                        const randomHeight = 20 + Math.random() * 70;
                        bar.style.height = `${randomHeight}%`;
                    });
                }, 500);
            }
        });
    }

    // View All button for recent commands
    const viewAllBtn = document.querySelector('.panel-header .btn-text');
    if (viewAllBtn) {
        viewAllBtn.addEventListener('click', function() {
            alert('This would show all recent commands in a real implementation.');
        });
    }

    // Command item clicks
    const commandItems = document.querySelectorAll('.command-item');
    commandItems.forEach(item => {
        item.addEventListener('click', function() {
            const commandName = this.querySelector('h4').textContent;
            alert(`You clicked on command: ${commandName}`);
        });
    });
}

// Function to simulate page changes
function simulatePageChange(pageName) {
    const title = document.querySelector('.dashboard-content h1');
    if (title) {
        title.textContent = pageName;
    }
    
    alert(`This would navigate to the ${pageName} page in a real implementation.`);
}

// Function to initialize animations
function initializeAnimations() {
    // Add fade-in animation to content panels
    const panels = document.querySelectorAll('.panel');
    panels.forEach((panel, index) => {
        panel.style.opacity = '0';
        panel.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            panel.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            panel.style.opacity = '1';
            panel.style.transform = 'translateY(0)';
        }, 200 + (index * 150));
    });
} 