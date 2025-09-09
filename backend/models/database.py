import os
from pymongo import MongoClient
from datetime import datetime, timedelta
import bcrypt
from bson import ObjectId
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Database:
    def __init__(self):
        self.client = None
        self.db = None
        self.connect()
    
    def connect(self):
        """Connect to MongoDB"""
        try:
            mongodb_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
            self.client = MongoClient(mongodb_uri)
            self.db = self.client['calendar_optimizer']
            
            # Test connection
            self.client.admin.command('ping')
            print("Connected to MongoDB successfully!")
            
        except Exception as e:
            print(f"MongoDB connection failed: {e}")
            # Fallback to in-memory storage for development
            self.db = None
    
    def get_collection(self, name):
        """Get a collection from the database"""
        if self.db is not None:
            return self.db[name]
        return None

# Initialize database connection
db = Database()

class User:
    def __init__(self):
        self.collection = db.get_collection('users')
    
    def create_user(self, email, password, name=None):
        """Create a new user"""
        if self.collection is None:
            return None
            
        # Check if user already exists
        if self.collection.find_one({"email": email}):
            return {"error": "User already exists"}
        
        # Hash password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        user_data = {
            "email": email,
            "password": hashed_password,
            "name": name or email.split('@')[0],
            "created_at": datetime.utcnow(),
            "last_login": datetime.utcnow(),
            "settings": {
                "timezone": "UTC",
                "default_event_duration": 60,
                "work_hours": {
                    "start": "09:00",
                    "end": "17:00"
                }
            }
        }
        
        result = self.collection.insert_one(user_data)
        user_data['_id'] = str(result.inserted_id)
        user_data.pop('password')  # Don't return password
        return user_data
    
    def authenticate(self, email, password):
        """Authenticate user login"""
        if self.collection is None:
            return None
            
        user = self.collection.find_one({"email": email})
        if user and bcrypt.checkpw(password.encode('utf-8'), user['password']):
            # Update last login
            self.collection.update_one(
                {"_id": user['_id']}, 
                {"$set": {"last_login": datetime.utcnow()}}
            )
            user['_id'] = str(user['_id'])
            user.pop('password')  # Don't return password
            return user
        return None
    
    def get_user(self, user_id):
        """Get user by ID"""
        if self.collection is None:
            return None
            
        user = self.collection.find_one({"_id": ObjectId(user_id)})
        if user:
            user['_id'] = str(user['_id'])
            user.pop('password', None)  # Don't return password
            return user
        return None

class Event:
    def __init__(self):
        self.collection = db.get_collection('events')
    
    def create_event(self, user_id, event_data):
        """Create a new event for a user"""
        if self.collection is None:
            return None
            
        event = {
            "user_id": user_id,
            "title": event_data.get('title'),
            "description": event_data.get('description', ''),
            "duration": event_data.get('duration', 60),
            "priority": event_data.get('priority', 2),
            "type": event_data.get('type', 'flexible'),
            "location": event_data.get('location', ''),
            "scheduled_time": event_data.get('scheduledTime'),
            "earliest_start": event_data.get('earliestStart'),
            "latest_start": event_data.get('latestStart'),
            "fixed_time": event_data.get('fixedTime'),
            "is_scheduled": event_data.get('isScheduled', False),
            "is_completed": False,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = self.collection.insert_one(event)
        event['_id'] = str(result.inserted_id)
        return event
    
    def get_user_events(self, user_id):
        """Get all events for a user"""
        if self.collection is None:
            return []
            
        events = list(self.collection.find({"user_id": user_id}))
        for event in events:
            event['_id'] = str(event['_id'])
            event['id'] = str(event['_id'])  # For frontend compatibility
        return events
    
    def update_event(self, event_id, user_id, update_data):
        """Update an event"""
        if self.collection is None:
            return None
            
        update_data['updated_at'] = datetime.utcnow()
        result = self.collection.update_one(
            {"_id": ObjectId(event_id), "user_id": user_id},
            {"$set": update_data}
        )
        
        if result.modified_count > 0:
            return self.collection.find_one({"_id": ObjectId(event_id)})
        return None
    
    def delete_event(self, event_id, user_id):
        """Delete an event"""
        if self.collection is None:
            return False
            
        result = self.collection.delete_one({"_id": ObjectId(event_id), "user_id": user_id})
        return result.deleted_count > 0
    
    def clear_user_events(self, user_id):
        """Clear all events for a user"""
        if self.collection is None:
            return False
            
        result = self.collection.delete_many({"user_id": user_id})
        return result.deleted_count > 0

# Initialize models
user_model = User()
event_model = Event()