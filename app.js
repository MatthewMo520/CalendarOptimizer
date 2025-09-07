class CalendarOptimizer {
    constructor() {
        this.events = [];
        this.calendar = null;
        this.initCalendar();
        this.bindEvents();
    }

    initCalendar() {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0); // 8 AM
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0); // 6 PM
        
        this.calendar = {
            startDate: startOfDay,
            endDate: endOfDay
        };

        this.generateCalendarGrid();
        this.setDefaultDateTimes();
    }

    setDefaultDateTimes() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0);

        const formatDateTime = (date) => {
            return date.toISOString().slice(0, 16);
        };

        document.getElementById('earliest-time').value = formatDateTime(today);
        document.getElementById('latest-time').value = formatDateTime(endOfDay);
        document.getElementById('fixed-datetime').value = formatDateTime(today);
    }

    bindEvents() {
        document.getElementById('event-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addEvent();
        });

        document.getElementById('fixed-time').addEventListener('change', (e) => {
            this.toggleTimeInputs(e.target.checked);
        });

        // Initialize API connection
        this.apiUrl = 'http://localhost:5000';
    }

    toggleTimeInputs(isFixed) {
        const timeConstraints = document.getElementById('time-constraints');
        const fixedTimeInput = document.getElementById('fixed-time-input');

        if (isFixed) {
            timeConstraints.style.display = 'none';
            fixedTimeInput.style.display = 'block';
        } else {
            timeConstraints.style.display = 'block';
            fixedTimeInput.style.display = 'none';
        }
    }

    async addEvent() {
        const title = document.getElementById('event-title').value;
        const duration = parseInt(document.getElementById('event-duration').value);
        const priority = parseInt(document.getElementById('event-priority').value);
        const isFixed = document.getElementById('fixed-time').checked;

        let eventData = {
            title,
            duration,
            priority
        };

        if (isFixed) {
            const fixedTime = document.getElementById('fixed-datetime').value;
            if (!fixedTime) {
                alert('Please specify a fixed time for this event.');
                return;
            }
            eventData.fixed_time = fixedTime;
        } else {
            const earliestTime = document.getElementById('earliest-time').value;
            const latestTime = document.getElementById('latest-time').value;
            
            if (!earliestTime || !latestTime) {
                alert('Please specify both earliest and latest start times.');
                return;
            }

            eventData.earliest_start = earliestTime;
            eventData.latest_start = latestTime;
        }

        try {
            const response = await fetch(`${this.apiUrl}/events`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData)
            });

            if (response.ok) {
                const result = await response.json();
                this.events.push(result.event);
                this.updateDisplay();
                this.clearForm();
            } else {
                throw new Error('Failed to add event');
            }
        } catch (error) {
            // Fallback to local storage if API is not available
            console.warn('API not available, using local storage');
            eventData.id = Date.now();
            eventData.scheduled_time = null;
            this.events.push(eventData);
            this.updateDisplay();
            this.clearForm();
        }
    }

    async optimizeSchedule() {
        try {
            const response = await fetch(`${this.apiUrl}/optimize`, {
                method: 'POST'
            });

            if (response.ok) {
                const result = await response.json();
                this.events = result.events;
                this.updateDisplay();
                this.updateStatus(result.success ? 'Optimized' : 'Partially Optimized', result.success);
            } else {
                throw new Error('Failed to optimize schedule');
            }
        } catch (error) {
            console.warn('API not available, using local optimization');
            this.localOptimization();
        }
    }

    localOptimization() {
        // Simple local optimization algorithm
        const unscheduled = this.events.filter(e => !e.scheduled_time);
        const scheduled = this.events.filter(e => e.scheduled_time);

        // Sort by priority (high to low)
        unscheduled.sort((a, b) => b.priority - a.priority);

        for (let event of unscheduled) {
            const slot = this.findAvailableSlot(event, scheduled);
            if (slot) {
                event.scheduled_time = slot.toISOString();
                scheduled.push(event);
            }
        }

        this.updateDisplay();
        this.updateStatus('Optimized Locally', true);
    }

    findAvailableSlot(event, scheduledEvents) {
        const startTime = event.fixed_time ? 
            new Date(event.fixed_time) : 
            new Date(event.earliest_start || this.calendar.startDate);
        
        const endConstraint = event.latest_start ? 
            new Date(event.latest_start) : 
            new Date(this.calendar.endDate.getTime() - event.duration * 60000);

        let currentTime = new Date(startTime);

        while (currentTime <= endConstraint) {
            const eventEnd = new Date(currentTime.getTime() + event.duration * 60000);
            
            // Check if this slot conflicts with any scheduled events
            const hasConflict = scheduledEvents.some(scheduled => {
                const scheduledStart = new Date(scheduled.scheduled_time);
                const scheduledEnd = new Date(scheduledStart.getTime() + scheduled.duration * 60000);
                
                return !(eventEnd <= scheduledStart || currentTime >= scheduledEnd);
            });

            if (!hasConflict && 
                currentTime >= this.calendar.startDate && 
                eventEnd <= this.calendar.endDate) {
                return currentTime;
            }

            // Move to next 15-minute slot
            currentTime = new Date(currentTime.getTime() + 15 * 60000);
        }

        return null;
    }

    async clearSchedule() {
        try {
            const response = await fetch(`${this.apiUrl}/clear`, {
                method: 'POST'
            });

            if (response.ok) {
                this.events = [];
                this.updateDisplay();
            } else {
                throw new Error('Failed to clear schedule');
            }
        } catch (error) {
            console.warn('API not available, clearing locally');
            this.events = [];
            this.updateDisplay();
        }
    }

    clearForm() {
        document.getElementById('event-form').reset();
        document.getElementById('event-priority').value = '2';
        document.getElementById('event-duration').value = '60';
        document.getElementById('fixed-time').checked = false;
        this.toggleTimeInputs(false);
        this.setDefaultDateTimes();
    }

    generateCalendarGrid() {
        const grid = document.getElementById('calendar-grid');
        grid.innerHTML = '';

        // Days of the week
        const days = ['Time', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        days.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            dayHeader.textContent = day;
            grid.appendChild(dayHeader);
        });

        // Time slots from 8 AM to 6 PM
        for (let hour = 8; hour <= 18; hour++) {
            // Time label
            const timeLabel = document.createElement('div');
            timeLabel.className = 'time-label';
            timeLabel.textContent = `${hour}:00`;
            grid.appendChild(timeLabel);

            // Day slots (for this demo, we'll focus on today)
            for (let day = 0; day < 7; day++) {
                const slot = document.createElement('div');
                slot.className = 'time-slot';
                slot.dataset.hour = hour;
                slot.dataset.day = day;
                grid.appendChild(slot);
            }
        }
    }

    updateDisplay() {
        this.updateCalendarGrid();
        this.updateEventsList();
        this.updateStatusBar();
    }

    updateCalendarGrid() {
        // Clear existing events from calendar
        document.querySelectorAll('.event-block').forEach(block => block.remove());

        const today = new Date();
        const todayEvents = this.events.filter(event => 
            event.scheduled_time && 
            new Date(event.scheduled_time).toDateString() === today.toDateString()
        );

        todayEvents.forEach(event => {
            const eventTime = new Date(event.scheduled_time);
            const hour = eventTime.getHours();
            const dayOfWeek = (eventTime.getDay() + 6) % 7; // Convert to Monday = 0

            const slot = document.querySelector(`[data-hour="${hour}"][data-day="${dayOfWeek}"]`);
            if (slot) {
                const eventBlock = document.createElement('div');
                eventBlock.className = `event-block priority-${this.getPriorityName(event.priority)}`;
                eventBlock.textContent = `${event.title} (${event.duration}m)`;
                eventBlock.title = `${event.title}\nDuration: ${event.duration} minutes\nPriority: ${this.getPriorityName(event.priority)}`;
                slot.appendChild(eventBlock);
            }
        });
    }

    updateEventsList() {
        const container = document.getElementById('events-container');
        container.innerHTML = '';

        if (this.events.length === 0) {
            container.innerHTML = '<p style="color: #718096; text-align: center;">No events added yet</p>';
            return;
        }

        this.events.forEach((event, index) => {
            const eventItem = document.createElement('div');
            eventItem.className = 'event-item';

            const scheduledText = event.scheduled_time ? 
                `Scheduled: ${new Date(event.scheduled_time).toLocaleString()}` :
                'Not scheduled';

            eventItem.innerHTML = `
                <div class="event-info">
                    <div class="event-title">${event.title}</div>
                    <div class="event-details">
                        Duration: ${event.duration} minutes | 
                        Priority: ${this.getPriorityName(event.priority)} | 
                        ${scheduledText}
                    </div>
                </div>
                <div class="event-actions">
                    <button class="btn btn-danger btn-small" onclick="app.removeEvent(${index})">Remove</button>
                </div>
            `;

            container.appendChild(eventItem);
        });
    }

    updateStatusBar() {
        const scheduledCount = this.events.filter(e => e.scheduled_time).length;
        const totalCount = this.events.length;
        const conflicts = this.findConflicts();

        document.getElementById('events-count').textContent = `${totalCount} events`;
        document.getElementById('conflicts-count').textContent = `${conflicts.length} conflicts`;

        const indicator = document.getElementById('schedule-indicator');
        const status = document.getElementById('schedule-status');

        if (conflicts.length > 0) {
            indicator.className = 'status-indicator error';
            status.textContent = 'Conflicts detected';
        } else if (scheduledCount === totalCount && totalCount > 0) {
            indicator.className = 'status-indicator';
            status.textContent = 'All scheduled';
        } else if (scheduledCount > 0) {
            indicator.className = 'status-indicator warning';
            status.textContent = 'Partially scheduled';
        } else {
            indicator.className = 'status-indicator';
            status.textContent = 'Ready';
        }
    }

    findConflicts() {
        const conflicts = [];
        const scheduled = this.events.filter(e => e.scheduled_time);

        for (let i = 0; i < scheduled.length; i++) {
            for (let j = i + 1; j < scheduled.length; j++) {
                const event1 = scheduled[i];
                const event2 = scheduled[j];

                const start1 = new Date(event1.scheduled_time);
                const end1 = new Date(start1.getTime() + event1.duration * 60000);
                const start2 = new Date(event2.scheduled_time);
                const end2 = new Date(start2.getTime() + event2.duration * 60000);

                if (!(end1 <= start2 || end2 <= start1)) {
                    conflicts.push([event1, event2]);
                }
            }
        }

        return conflicts;
    }

    removeEvent(index) {
        this.events.splice(index, 1);
        this.updateDisplay();
    }

    getPriorityName(priority) {
        const priorities = { 1: 'low', 2: 'medium', 3: 'high' };
        return priorities[priority] || 'medium';
    }

    updateStatus(message, success) {
        const status = document.getElementById('schedule-status');
        const indicator = document.getElementById('schedule-indicator');
        
        status.textContent = message;
        indicator.className = success ? 'status-indicator' : 'status-indicator warning';
        
        setTimeout(() => this.updateStatusBar(), 3000);
    }
}

// Global functions for button onclick handlers
function optimizeSchedule() {
    app.optimizeSchedule();
}

function clearSchedule() {
    if (confirm('Are you sure you want to clear all events?')) {
        app.clearSchedule();
    }
}

// Initialize the app when the page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new CalendarOptimizer();
});