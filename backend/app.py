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
        'id': str(id(event)),  # Use object id as unique identifier
        'title': event.title,
        'duration': event.duration,
        'priority': event.priority.value,
        'type': getattr(event, 'type', 'flexible'),  # Default to flexible if not set
        'scheduledTime': event.scheduled_time.isoformat() if event.scheduled_time else None,
        'earliestStart': event.earliest_start.isoformat() if event.earliest_start else None,
        'latestStart': event.latest_start.isoformat() if event.latest_start else None,
        'fixedTime': event.fixed_time.isoformat() if event.fixed_time else None,
        'isScheduled': event.is_scheduled,
        'description': getattr(event, 'description', None),
        'location': getattr(event, 'location', None)
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
        
        # Extract additional fields
        event_type = data.get('type', 'flexible')
        description = data.get('description', None)
        location = data.get('location', None)
        
        # Create event based on whether it's fixed time or flexible
        if 'fixedTime' in data and data['fixedTime']:
            fixed_time = datetime.fromisoformat(data['fixedTime'].replace('T', ' '))
            event = Event(
                title=data['title'],
                duration=data['duration'],
                priority=priority,
                fixed_time=fixed_time,
                event_type=event_type,
                description=description,
                location=location
            )
        else:
            earliest_start = None
            latest_start = None
            
            if 'earliestStart' in data and data['earliestStart']:
                earliest_start = datetime.fromisoformat(data['earliestStart'].replace('T', ' '))
            
            if 'latestStart' in data and data['latestStart']:
                latest_start = datetime.fromisoformat(data['latestStart'].replace('T', ' '))
            
            event = Event(
                title=data['title'],
                duration=data['duration'],
                priority=priority,
                earliest_start=earliest_start,
                latest_start=latest_start,
                event_type=event_type,
                description=description,
                location=location
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

@app.route('/events/<event_id>', methods=['DELETE'])
def delete_event(event_id):
    global calendar_instance
    
    if not calendar_instance:
        return jsonify({'success': False, 'message': 'Calendar not initialized'}), 400
    
    try:
        # Find event by ID (using object id)
        event_to_remove = None
        for event in calendar_instance.events:
            if str(id(event)) == event_id:
                event_to_remove = event
                break
        
        if event_to_remove:
            calendar_instance.remove_event(event_to_remove)
            return jsonify({'success': True, 'message': 'Event deleted successfully'})
        else:
            return jsonify({'success': False, 'message': 'Event not found'}), 404
    
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error deleting event: {str(e)}'}), 500

@app.route('/chat', methods=['POST'])
def chat_endpoint():
    """Simple chatbot endpoint for natural language event creation"""
    data = request.json
    message = data.get('message', '').lower()
    
    try:
        # Simple keyword-based parsing (you could integrate with more sophisticated NLP)
        response = {
            'reply': '',
            'suggestedEvent': None,
            'action': 'info'
        }
        
        # Extract potential event information
        suggested_event = parse_natural_language_simple(message)
        
        if suggested_event:
            response['reply'] = f"I understand you want to add: \"{suggested_event['title']}\"\nDuration: {suggested_event['duration']} minutes\nShall I add this to your calendar?"
            response['suggestedEvent'] = suggested_event
            response['action'] = 'create_event'
        else:
            response['reply'] = "I'd be happy to help you add events! Try saying something like:\n- 'I need to study math for 2 hours'\n- 'Schedule a meeting with John at 3 PM tomorrow'\n- 'Add my chemistry class every Monday at 9 AM'"
            response['action'] = 'info'
        
        return jsonify(response)
    
    except Exception as e:
        return jsonify({
            'reply': f'Sorry, I had trouble understanding that. Could you try rephrasing?',
            'action': 'info'
        })

def parse_natural_language_simple(message):
    """Simple natural language parsing for events"""
    import re
    
    # Extract duration
    duration_match = re.search(r'(\d+)\s*(hours?|hrs?|h|minutes?|mins?|m)', message)
    duration = 60  # default
    
    if duration_match:
        value = int(duration_match.group(1))
        unit = duration_match.group(2).lower()
        if unit.startswith('h'):
            duration = value * 60
        else:
            duration = value
    
    # Extract title/subject
    title = "Study Session"  # default
    
    subjects = ['math', 'science', 'english', 'history', 'chemistry', 'physics', 'programming', 'coding']
    activities = ['study', 'meeting', 'class', 'lecture', 'review', 'practice', 'workout', 'exercise']
    
    found_subject = None
    found_activity = None
    
    for subject in subjects:
        if subject in message:
            found_subject = subject.capitalize()
            break
    
    for activity in activities:
        if activity in message:
            found_activity = activity.capitalize()
            break
    
    if found_activity and found_subject:
        title = f"{found_activity} {found_subject}"
    elif found_subject:
        title = f"Study {found_subject}"
    elif found_activity:
        title = found_activity
    
    # Determine priority
    priority = 2  # medium default
    if any(word in message for word in ['urgent', 'important', 'asap', 'critical']):
        priority = 3
    elif any(word in message for word in ['low', 'optional', 'maybe']):
        priority = 1
    
    # Determine type
    event_type = 'flexible'
    if any(word in message for word in ['class', 'lecture', 'mandatory', 'must']):
        event_type = 'mandatory'
    elif any(word in message for word in ['at', 'pm', 'am', ':']):
        event_type = 'fixed'
    
    return {
        'title': title,
        'duration': duration,
        'priority': priority,
        'type': event_type
    }

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