from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
from event import Event, Priority
from scheduler import Calendar
from optimizer import ScheduleOptimizer

app = Flask(__name__)
CORS(app)

# Global variables to maintain state
calendar_instance = None
optimizer_instance = None

def initialize_calendar():
    global calendar_instance, optimizer_instance
    
    # Initialize calendar for today from 8 AM to 6 PM
    today = datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)
    end_time = today.replace(hour=18)
    
    calendar_instance = Calendar(today, end_time)
    optimizer_instance = ScheduleOptimizer(calendar_instance)

def event_to_dict(event):
    return {
        'id': id(event),  # Use object id as unique identifier
        'title': event.title,
        'duration': event.duration,
        'priority': event.priority.value,
        'scheduled_time': event.scheduled_time.isoformat() if event.scheduled_time else None,
        'earliest_start': event.earliest_start.isoformat() if event.earliest_start else None,
        'latest_start': event.latest_start.isoformat() if event.latest_start else None,
        'fixed_time': event.fixed_time.isoformat() if event.fixed_time else None,
        'is_scheduled': event.is_scheduled
    }

@app.route('/events', methods=['GET'])
def get_events():
    if not calendar_instance:
        return jsonify({'events': []})
    
    events_data = [event_to_dict(event) for event in calendar_instance.events]
    return jsonify({'events': events_data})

@app.route('/events', methods=['POST'])
def add_event():
    global calendar_instance
    
    if not calendar_instance:
        initialize_calendar()
    
    data = request.json
    
    try:
        # Parse priority
        priority_value = data.get('priority', 2)
        priority = Priority(priority_value)
        
        # Create event based on whether it's fixed time or flexible
        if 'fixed_time' in data and data['fixed_time']:
            fixed_time = datetime.fromisoformat(data['fixed_time'].replace('T', ' '))
            event = Event(
                title=data['title'],
                duration=data['duration'],
                priority=priority,
                fixed_time=fixed_time
            )
        else:
            earliest_start = None
            latest_start = None
            
            if 'earliest_start' in data and data['earliest_start']:
                earliest_start = datetime.fromisoformat(data['earliest_start'].replace('T', ' '))
            
            if 'latest_start' in data and data['latest_start']:
                latest_start = datetime.fromisoformat(data['latest_start'].replace('T', ' '))
            
            event = Event(
                title=data['title'],
                duration=data['duration'],
                priority=priority,
                earliest_start=earliest_start,
                latest_start=latest_start
            )
        
        # Add event to calendar
        success = calendar_instance.add_event(event)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Event added successfully',
                'event': event_to_dict(event)
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Event already exists'
            }), 400
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error adding event: {str(e)}'
        }), 400

@app.route('/optimize', methods=['POST'])
def optimize_schedule():
    global optimizer_instance
    
    if not optimizer_instance:
        return jsonify({
            'success': False,
            'message': 'Calendar not initialized'
        }), 400
    
    try:
        # Optimize the schedule
        success = optimizer_instance.optimize_schedule()
        
        # Try to resolve conflicts
        resolutions = optimizer_instance.resolve_conflicts()
        
        # Get updated events
        events_data = [event_to_dict(event) for event in calendar_instance.events]
        
        return jsonify({
            'success': success,
            'events': events_data,
            'resolutions': [
                {
                    'event1': event1.title,
                    'event2': event2.title,
                    'resolution': resolution
                }
                for event1, event2, resolution in resolutions
            ],
            'report': optimizer_instance.get_optimization_report()
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error optimizing schedule: {str(e)}'
        }), 500

@app.route('/clear', methods=['POST'])
def clear_schedule():
    global calendar_instance
    
    if calendar_instance:
        calendar_instance.events.clear()
    
    return jsonify({
        'success': True,
        'message': 'Schedule cleared'
    })

@app.route('/schedule/summary', methods=['GET'])
def get_schedule_summary():
    if not calendar_instance:
        return jsonify({
            'summary': 'No calendar initialized'
        })
    
    return jsonify({
        'summary': calendar_instance.get_schedule_summary()
    })

@app.route('/conflicts', methods=['GET'])
def get_conflicts():
    if not calendar_instance:
        return jsonify({'conflicts': []})
    
    conflicts = calendar_instance.get_conflicts()
    conflicts_data = [
        {
            'event1': event1.title,
            'event2': event2.title,
            'event1_time': event1.scheduled_time.isoformat() if event1.scheduled_time else None,
            'event2_time': event2.scheduled_time.isoformat() if event2.scheduled_time else None
        }
        for event1, event2 in conflicts
    ]
    
    return jsonify({'conflicts': conflicts_data})

@app.route('/available-slots', methods=['GET'])
def get_available_slots():
    if not calendar_instance:
        return jsonify({'slots': []})
    
    duration = int(request.args.get('duration', 60))
    earliest_start = request.args.get('earliest_start')
    latest_start = request.args.get('latest_start')
    
    earliest_dt = None
    latest_dt = None
    
    if earliest_start:
        earliest_dt = datetime.fromisoformat(earliest_start.replace('T', ' '))
    
    if latest_start:
        latest_dt = datetime.fromisoformat(latest_start.replace('T', ' '))
    
    slots = calendar_instance.find_available_slots(duration, earliest_dt, latest_dt)
    slots_data = [slot.isoformat() for slot in slots]
    
    return jsonify({
        'slots': slots_data,
        'count': len(slots_data)
    })

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'calendar_initialized': calendar_instance is not None,
        'event_count': len(calendar_instance.events) if calendar_instance else 0
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'message': 'Endpoint not found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'message': 'Internal server error'
    }), 500

if __name__ == '__main__':
    initialize_calendar()
    print("Calendar AI Optimizer API starting...")
    print("Calendar initialized for today (8 AM - 6 PM)")
    print("Frontend available at: http://localhost:5000/")
    print("API endpoints available at: http://localhost:5000/")
    
    # Serve static files (HTML, CSS, JS) from the same directory
    from flask import send_from_directory
    
    @app.route('/')
    def serve_index():
        return send_from_directory('.', 'index.html')
    
    @app.route('/app.js')
    def serve_js():
        return send_from_directory('.', 'app.js')
    
    app.run(debug=True, host='0.0.0.0', port=5000)