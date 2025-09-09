from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from models.database import user_model, event_model
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

# JWT Configuration
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-this')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=1)
jwt = JWTManager(app)

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Calendar API with MongoDB is running!'})

# Authentication endpoints
@app.route('/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        name = data.get('name')
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        # Create user
        user = user_model.create_user(email, password, name)
        
        if isinstance(user, dict) and 'error' in user:
            return jsonify(user), 409
        
        # Create access token
        access_token = create_access_token(identity=str(user['_id']))
        
        return jsonify({
            'user': user,
            'token': access_token,
            'message': 'User registered successfully!'
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        # Authenticate user
        user = user_model.authenticate(email, password)
        
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Create access token
        access_token = create_access_token(identity=str(user['_id']))
        
        return jsonify({
            'user': user,
            'token': access_token,
            'message': 'Login successful!'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/auth/me', methods=['GET'])
@jwt_required()
def get_current_user():
    try:
        user_id = get_jwt_identity()
        user = user_model.get_user(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({'user': user}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Event endpoints
@app.route('/events', methods=['GET'])
@jwt_required()
def get_events():
    try:
        user_id = get_jwt_identity()
        events = event_model.get_user_events(user_id)
        
        return jsonify({'events': events}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/events', methods=['POST'])
@jwt_required()
def create_event():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data.get('title'):
            return jsonify({'error': 'Title is required'}), 400
        
        # Create event
        event = event_model.create_event(user_id, data)
        
        if not event:
            return jsonify({'error': 'Failed to create event'}), 500
        
        return jsonify({
            'event': event,
            'message': 'Event created successfully!'
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/events/<event_id>', methods=['PUT'])
@jwt_required()
def update_event(event_id):
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Update event
        event = event_model.update_event(event_id, user_id, data)
        
        if not event:
            return jsonify({'error': 'Event not found or unauthorized'}), 404
        
        event['_id'] = str(event['_id'])
        
        return jsonify({
            'event': event,
            'message': 'Event updated successfully!'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/events/<event_id>', methods=['DELETE'])
@jwt_required()
def delete_event(event_id):
    try:
        user_id = get_jwt_identity()
        
        success = event_model.delete_event(event_id, user_id)
        
        if not success:
            return jsonify({'error': 'Event not found or unauthorized'}), 404
        
        return jsonify({'message': 'Event deleted successfully!'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/events/clear', methods=['DELETE'])
@jwt_required()
def clear_events():
    try:
        user_id = get_jwt_identity()
        
        success = event_model.clear_user_events(user_id)
        
        return jsonify({
            'message': f'Cleared events successfully!',
            'cleared_count': success
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Basic optimization endpoint (simplified)
@app.route('/optimize', methods=['POST'])
@jwt_required()
def optimize_schedule():
    try:
        user_id = get_jwt_identity()
        events = event_model.get_user_events(user_id)
        
        # Simple optimization logic - sort by priority and schedule sequentially
        flexible_events = [e for e in events if e.get('type') != 'fixed' and not e.get('is_scheduled')]
        
        # Sort by priority (1=high, 2=medium, 3=low)
        flexible_events.sort(key=lambda x: x.get('priority', 2))
        
        # Schedule events starting from 9 AM
        current_time = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)
        
        optimized_events = []
        for event in flexible_events:
            # Schedule the event
            scheduled_time = current_time.isoformat()
            duration = event.get('duration', 60)
            
            # Update in database
            update_data = {
                'scheduled_time': scheduled_time,
                'is_scheduled': True
            }
            
            updated_event = event_model.update_event(event['_id'], user_id, update_data)
            if updated_event:
                updated_event['_id'] = str(updated_event['_id'])
                updated_event['id'] = str(updated_event['_id'])
                optimized_events.append(updated_event)
            
            # Move to next time slot
            current_time += timedelta(minutes=duration + 15)  # Add 15 min buffer
        
        return jsonify({
            'events': optimized_events,
            'conflicts': [],  # Simplified - no conflict detection for now
            'message': 'Schedule optimized successfully!'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Guest/demo endpoints (no authentication required)
@app.route('/demo/events', methods=['GET'])
def demo_get_events():
    # Return demo data for frontend development
    demo_events = [
        {
            'id': 'demo1',
            'title': 'Morning Meeting',
            'duration': 60,
            'priority': 1,
            'type': 'fixed',
            'scheduledTime': '2024-01-01T09:00:00Z',
            'isScheduled': True
        }
    ]
    return jsonify({'events': demo_events}), 200

@app.route('/demo/events', methods=['POST'])
def demo_create_event():
    data = request.get_json()
    # Return the event data back with an ID
    event = {
        'id': f"demo_{datetime.now().timestamp()}",
        'isScheduled': False,
        **data
    }
    return jsonify({'event': event}), 201

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)