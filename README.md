# Calendar AI Optimizer

A smart calendar scheduling application that uses AI-powered optimization to automatically arrange your events based on priorities, constraints, and availability.

## Features

- **Smart Event Scheduling**: Automatically optimizes your schedule based on event priorities and time constraints
- **Flexible Time Management**: Support for both fixed-time and flexible events
- **Conflict Resolution**: Intelligent conflict detection and resolution
- **Interactive Web Interface**: Modern, responsive web UI for easy event management
- **Real-time Updates**: Live calendar view with drag-and-drop functionality
- **Priority-based Optimization**: High, medium, and low priority events are scheduled accordingly

## Quick Start

1. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Start the Application**
   ```bash
   python app.py
   ```

3. **Open Your Browser**
   Navigate to `http://localhost:5000` to access the web interface

## Usage

### Web Interface

1. **Add Events**: Use the sidebar form to add new events with:
   - Event title and duration
   - Priority level (High, Medium, Low)
   - Time constraints (flexible or fixed time)

2. **Optimize Schedule**: Click "Optimize Schedule" to let the AI arrange your events optimally

3. **View Results**: See your optimized schedule in the calendar grid and events list

### Command Line Interface

Run the original command-line version:
```bash
python main.py
```

## API Endpoints

The Flask backend provides several API endpoints:

- `GET /events` - Get all events
- `POST /events` - Add a new event
- `POST /optimize` - Optimize the current schedule
- `POST /clear` - Clear all events
- `GET /conflicts` - Get current conflicts
- `GET /available-slots` - Find available time slots
- `GET /health` - Health check

## Project Structure

```
CalendarOptimizer/
├── app.py              # Flask web server
├── index.html          # Frontend HTML
├── app.js              # Frontend JavaScript
├── main.py             # CLI version
├── event.py            # Event class definition
├── scheduler.py        # Calendar management (renamed from calendar.py)
├── optimizer.py        # Optimization algorithms
├── requirements.txt    # Python dependencies
└── README.md          # This file
```

## How It Works

The optimizer uses a priority-based scheduling algorithm:

1. **Event Sorting**: Events are sorted by priority (high to low), fixed-time constraints, and duration
2. **Slot Finding**: For each event, the system finds available time slots within the specified constraints
3. **Conflict Resolution**: When conflicts occur, lower-priority or more flexible events are rescheduled
4. **Optimization**: The system maximizes the number of scheduled events while minimizing conflicts

## Technologies Used

- **Backend**: Python, Flask, Flask-CORS
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Styling**: Custom CSS with modern gradients and responsive design
- **Architecture**: RESTful API with JSON communication

## Browser Compatibility

The web interface works on all modern browsers including:
- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## Contributing

This is a personal project, but feel free to fork and modify for your own use!

## License

This project is open source and available under the MIT License.