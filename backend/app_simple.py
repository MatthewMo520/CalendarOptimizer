from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from datetime import datetime, timedelta
import json

app = Flask(__name__)
CORS(app)

# Simple in-memory storage (replace with database later)
events = []
event_counter = 1

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"})

@app.route('/events', methods=['GET'])
def get_events():
    return jsonify({"events": events})

@app.route('/events', methods=['POST'])
def create_event():
    global event_counter
    try:
        data = request.json
        
        # Create new event
        event = {
            "id": str(event_counter),
            "title": data.get('title', 'New Event'),
            "duration": data.get('duration', 60),
            "priority": data.get('priority', 2),
            "type": data.get('type', 'flexible'),
            "description": data.get('description'),
            "location": data.get('location'),
            "earliestStart": data.get('earliestStart'),
            "latestStart": data.get('latestStart'),
            "fixedTime": data.get('fixedTime'),
            "isScheduled": False,
            "createdAt": datetime.now().isoformat()
        }
        
        events.append(event)
        event_counter += 1
        
        return jsonify({"event": event}), 201
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/events/<event_id>', methods=['DELETE'])
def delete_event(event_id):
    global events
    events = [e for e in events if e['id'] != event_id]
    return jsonify({"success": True})

@app.route('/events/clear', methods=['DELETE'])
def clear_events():
    global events
    events = []
    return jsonify({"success": True})

@app.route('/conflicts', methods=['GET'])
def get_conflicts():
    # Simple conflict detection
    conflicts = []
    scheduled_events = [e for e in events if e.get('scheduledTime') and e.get('isScheduled')]
    
    for i, event1 in enumerate(scheduled_events):
        for j, event2 in enumerate(scheduled_events[i+1:], i+1):
            # Simple time overlap check
            if event1.get('scheduledTime') and event2.get('scheduledTime'):
                time1 = datetime.fromisoformat(event1['scheduledTime'].replace('Z', '+00:00'))
                time2 = datetime.fromisoformat(event2['scheduledTime'].replace('Z', '+00:00'))
                
                end1 = time1 + timedelta(minutes=event1['duration'])
                end2 = time2 + timedelta(minutes=event2['duration'])
                
                # Check for overlap
                if (time1 < end2 and time2 < end1):
                    conflicts.append({
                        "event1": event1['title'],
                        "event2": event2['title'],
                        "time": time1.isoformat()
                    })
    
    return jsonify({"conflicts": conflicts})

@app.route('/optimize', methods=['POST'])
def optimize_schedule():
    # Enhanced optimization: handle both fixed and flexible events
    global events
    import re
    
    flexible_events = [e for e in events if e['type'] == 'flexible' and not e.get('isScheduled')]
    fixed_events = [e for e in events if e['type'] in ['fixed', 'mandatory'] or e.get('fixedTime')]
    
    # Sort flexible events by priority (1=high, 3=low)
    flexible_events.sort(key=lambda x: x['priority'])
    
    # Start scheduling at 9 AM today
    current_time = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)
    
    optimized_events = []
    
    # Process fixed events with proper scheduling
    for event in fixed_events:
        event_copy = event.copy()
        event_copy['isScheduled'] = True
        
        # Parse fixed time if it's a string (from schedule upload)
        if event.get('fixedTime') and isinstance(event['fixedTime'], str):
            time_match = re.search(r'(\d{1,2}):(\d{2})\s*(AM|PM)?', event['fixedTime'], re.IGNORECASE)
            if time_match:
                hours, minutes, ampm = time_match.groups()
                hour24 = int(hours)
                
                # Convert to 24-hour format
                if ampm and ampm.upper() == 'PM' and hour24 != 12:
                    hour24 += 12
                elif ampm and ampm.upper() == 'AM' and hour24 == 12:
                    hour24 = 0
                
                # Create scheduled time for the correct day of the week
                # Start with the beginning of the current week (Monday)
                today = datetime.now()
                start_of_week = today - timedelta(days=today.weekday())  # Monday of current week
                schedule_time = start_of_week.replace(hour=hour24, minute=int(minutes), second=0, microsecond=0)
                
                # If event has dayOfWeek, schedule for that day of the current week
                if event.get('dayOfWeek') is not None:
                    target_day = event['dayOfWeek']
                    
                    # Convert Sunday=0 to Monday=0 system (target_day - 1, but handle Sunday specially)
                    if target_day == 0:  # Sunday
                        python_target_day = 6
                    else:
                        python_target_day = target_day - 1
                    
                    # Schedule for the specific day of the current week
                    schedule_time = start_of_week + timedelta(days=python_target_day)
                    schedule_time = schedule_time.replace(hour=hour24, minute=int(minutes), second=0, microsecond=0)
                
                event_copy['scheduledTime'] = schedule_time.isoformat()
        
        # Update the original event in the events list
        for i, original_event in enumerate(events):
            if original_event['id'] == event['id']:
                events[i] = event_copy
                break
                
        optimized_events.append(event_copy)
    
    # Schedule flexible events
    for event in flexible_events:
        event_copy = event.copy()
        event_copy['scheduledTime'] = current_time.isoformat()
        event_copy['isScheduled'] = True
        
        # Update the original event in the events list
        for i, original_event in enumerate(events):
            if original_event['id'] == event['id']:
                events[i] = event_copy
                break
                
        optimized_events.append(event_copy)
        current_time += timedelta(minutes=event['duration'])
    
    # Get updated conflicts
    conflicts_response = get_conflicts()
    conflicts = json.loads(conflicts_response.get_data())['conflicts']
    
    return jsonify({
        "events": events,
        "conflicts": conflicts,
        "report": f"Optimized {len(flexible_events)} flexible events and {len(fixed_events)} fixed events"
    })

@app.route('/chat', methods=['POST'])
def chat_endpoint():
    """Simple endpoint for AI chat - frontend handles the AI logic"""
    try:
        data = request.json
        message = data.get('message', '')
        context = data.get('context', {})
        
        # This endpoint could be used for server-side AI processing
        # For now, just return a simple response to indicate the endpoint works
        return jsonify({
            "reply": "Chat endpoint is working. AI processing is handled in the frontend.",
            "action": "chat"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    print("Starting simple Calendar API server...")
    print("API will be available at: http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)