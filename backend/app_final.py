from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import json
import os
from event import Event, Priority
from scheduler import Calendar
from optimizer import ScheduleOptimizer

# MongoDB setup
try:
    from pymongo import MongoClient
    MONGODB_URI = "mongodb+srv://mathmatthewmo_db_user:seJ5MTcp1SroeDu2@cluster0.r0rfnqc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
    client = MongoClient(MONGODB_URI)
    db = client['calendar_optimizer']
    events_collection = db['events']
    # Test connection
    client.admin.command('ping')
    print("Connected to MongoDB Atlas successfully!")
    USE_MONGODB = True
except Exception as e:
    print(f"MongoDB connection failed: {e}")
    print("Falling back to file persistence...")
    USE_MONGODB = False
    events_collection = None

app = Flask(__name__)
CORS(app)

# Global variables to maintain state
calendar_instance = None
optimizer_instance = None

# File for persistence fallback
EVENTS_FILE = 'events_data.json'

def save_events_to_mongo():
    """Save events to MongoDB"""
    if not USE_MONGODB or events_collection is None or not calendar_instance:
        return False
    try:
        # Clear existing events
        events_collection.delete_many({})
        
        # Save current events
        for event in calendar_instance.events:
            event_dict = {
                'title': event.title,
                'duration': event.duration,
                'priority': event.priority.value,
                'type': getattr(event, 'type', 'flexible'),
                'scheduled_time': event.scheduled_time.isoformat() if event.scheduled_time else None,
                'earliest_start': event.earliest_start.isoformat() if event.earliest_start else None,
                'latest_start': event.latest_start.isoformat() if event.latest_start else None,
                'fixed_time': event.fixed_time.isoformat() if event.fixed_time else None,
                'description': getattr(event, 'description', None),
                'location': getattr(event, 'location', None),
                'day_of_week': getattr(event, 'day_of_week', None),
                'is_scheduled': event.is_scheduled,
                'created_at': datetime.utcnow()
            }
            events_collection.insert_one(event_dict)
        
        print(f"Saved {len(calendar_instance.events)} events to MongoDB")
        return True
    except Exception as e:
        print(f"Error saving to MongoDB: {e}")
        return False

def load_events_from_mongo():
    """Load events from MongoDB"""
    if not USE_MONGODB or events_collection is None or not calendar_instance:
        return False
    try:
        events_data = list(events_collection.find({}))
        
        for event_dict in events_data:
            # Parse datetime strings back to datetime objects
            earliest_start = None
            latest_start = None
            fixed_time = None
            scheduled_time = None
            
            if event_dict.get('earliest_start'):
                earliest_start = datetime.fromisoformat(event_dict['earliest_start'])
            if event_dict.get('latest_start'):
                latest_start = datetime.fromisoformat(event_dict['latest_start'])
            if event_dict.get('fixed_time'):
                fixed_time = datetime.fromisoformat(event_dict['fixed_time'])
            if event_dict.get('scheduled_time'):
                scheduled_time = datetime.fromisoformat(event_dict['scheduled_time'])
            
            # Create event object
            event = Event(
                title=event_dict['title'],
                duration=event_dict['duration'],
                priority=Priority(event_dict['priority']),
                earliest_start=earliest_start,
                latest_start=latest_start,
                fixed_time=fixed_time,
                event_type=event_dict.get('type', 'flexible'),
                description=event_dict.get('description'),
                location=event_dict.get('location'),
                day_of_week=event_dict.get('day_of_week')
            )
            
            # Set scheduled time if it exists
            if scheduled_time:
                event.scheduled_time = scheduled_time
            
            calendar_instance.events.append(event)
        
        print(f"Loaded {len(events_data)} events from MongoDB")
        return True
    except Exception as e:
        print(f"Error loading from MongoDB: {e}")
        return False

def save_events_to_file():
    """Save events to JSON file (fallback)"""
    if not calendar_instance:
        return False
    try:
        events_data = []
        for event in calendar_instance.events:
            events_data.append({
                'title': event.title,
                'duration': event.duration,
                'priority': event.priority.value,
                'type': getattr(event, 'type', 'flexible'),
                'scheduled_time': event.scheduled_time.isoformat() if event.scheduled_time else None,
                'earliest_start': event.earliest_start.isoformat() if event.earliest_start else None,
                'latest_start': event.latest_start.isoformat() if event.latest_start else None,
                'fixed_time': event.fixed_time.isoformat() if event.fixed_time else None,
                'description': getattr(event, 'description', None),
                'location': getattr(event, 'location', None),
                'day_of_week': getattr(event, 'day_of_week', None)
            })
        
        with open(EVENTS_FILE, 'w') as f:
            json.dump(events_data, f)
        print(f"Saved {len(events_data)} events to file")
        return True
    except Exception as e:
        print(f"Error saving to file: {e}")
        return False

def load_events_from_file():
    """Load events from JSON file (fallback)"""
    if not os.path.exists(EVENTS_FILE) or not calendar_instance:
        return False
    try:
        with open(EVENTS_FILE, 'r') as f:
            events_data = json.load(f)
        
        for data in events_data:
            event = Event(
                title=data['title'],
                duration=data['duration'],
                priority=Priority(data['priority']),
                earliest_start=datetime.fromisoformat(data['earliest_start']) if data.get('earliest_start') else None,
                latest_start=datetime.fromisoformat(data['latest_start']) if data.get('latest_start') else None,
                fixed_time=datetime.fromisoformat(data['fixed_time']) if data.get('fixed_time') else None,
                event_type=data.get('type', 'flexible'),
                description=data.get('description'),
                location=data.get('location'),
                day_of_week=data.get('day_of_week')
            )
            if data.get('scheduled_time'):
                event.scheduled_time = datetime.fromisoformat(data['scheduled_time'])
            calendar_instance.events.append(event)
        
        print(f"Loaded {len(events_data)} events from file")
        return True
    except Exception as e:
        print(f"Error loading from file: {e}")
        return False

def save_events():
    """Save events using MongoDB if available, otherwise file"""
    if USE_MONGODB:
        return save_events_to_mongo()
    else:
        return save_events_to_file()

def load_events():
    """Load events using MongoDB if available, otherwise file"""
    if USE_MONGODB:
        return load_events_from_mongo()
    else:
        return load_events_from_file()

def initialize_calendar():
    global calendar_instance, optimizer_instance
    
    # Initialize calendar for today from 8 AM to 6 PM
    today = datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)
    end_time = today.replace(hour=18)
    
    calendar_instance = Calendar(today, end_time)
    optimizer_instance = ScheduleOptimizer(calendar_instance)
    
    # Load existing events
    load_events()

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
        'location': getattr(event, 'location', None),
        'dayOfWeek': getattr(event, 'day_of_week', None)
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
    print(f"Received event data: {data}")  # Debug log
    
    try:
        # Parse priority
        priority_value = data.get('priority', 2)
        priority = Priority(priority_value)
        
        # Extract additional fields
        event_type = data.get('type', 'flexible')
        description = data.get('description', None)
        location = data.get('location', None)
        day_of_week = data.get('dayOfWeek', None)
        
        print(f"Creating event with dayOfWeek: {day_of_week}")  # Debug log
        
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
                location=location,
                day_of_week=day_of_week
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
                location=location,
                day_of_week=day_of_week
            )
        
        # Add event to calendar
        success = calendar_instance.add_event(event)
        
        if success:
            save_events()  # Save after adding
            print(f"Event created successfully: {event.title}")  # Debug log
            return jsonify({
                'success': True,
                'message': 'Event added successfully',
                'event': event_to_dict(event)
            })
        else:
            print(f"Failed to add event to calendar: {event.title}")  # Debug log
            return jsonify({
                'success': False,
                'message': 'Event already exists'
            }), 400
    
    except Exception as e:
        print(f"Error creating event: {str(e)}")  # Debug log
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
        
        save_events()  # Save after optimization
        
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
        save_events()  # Save cleared state
    
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
            save_events()  # Save after deletion
            return jsonify({'success': True, 'message': 'Event deleted successfully'})
        else:
            return jsonify({'success': False, 'message': 'Event not found'}), 404
    
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error deleting event: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'calendar_initialized': calendar_instance is not None,
        'event_count': len(calendar_instance.events) if calendar_instance else 0,
        'persistence_type': 'MongoDB Atlas' if USE_MONGODB else 'File-based',
        'mongodb_connected': USE_MONGODB
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
    persistence_type = "MongoDB Atlas" if USE_MONGODB else "File-based"
    print(f"Using {persistence_type} persistence")
    print("Calendar initialized for today (8 AM - 6 PM)")
    print("Frontend available at: http://localhost:5000/")
    print("API endpoints available at: http://localhost:5000/")
    
    app.run(debug=True, host='0.0.0.0', port=5000)