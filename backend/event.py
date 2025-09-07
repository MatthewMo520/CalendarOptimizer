from datetime import datetime, timedelta
from typing import Optional, Tuple
from enum import Enum

class Priority(Enum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3

class Event:
    def __init__(
        self,
        title: str,
        duration: int,  # minutes
        priority: Priority = Priority.MEDIUM,
        earliest_start: Optional[datetime] = None,
        latest_start: Optional[datetime] = None,
        fixed_time: Optional[datetime] = None,
        event_type: str = 'flexible',  # 'flexible', 'fixed', 'mandatory'
        description: Optional[str] = None,
        location: Optional[str] = None
    ):
        self.title = title
        self.duration = duration
        self.priority = priority
        self.fixed_time = fixed_time
        self.type = event_type
        self.description = description
        self.location = location
        
        if fixed_time:
            self.earliest_start = fixed_time
            self.latest_start = fixed_time
            self.type = 'fixed'  # Override type if fixed_time is provided
        else:
            self.earliest_start = earliest_start
            self.latest_start = latest_start
        
        self.scheduled_time: Optional[datetime] = None
    
    @property
    def is_scheduled(self) -> bool:
        return self.scheduled_time is not None
    
    @property
    def end_time(self) -> Optional[datetime]:
        if self.scheduled_time:
            return self.scheduled_time + timedelta(minutes=self.duration)
        return None
    
    def conflicts_with(self, other: 'Event') -> bool:
        if not (self.is_scheduled and other.is_scheduled):
            return False
        
        self_start = self.scheduled_time
        self_end = self.end_time
        other_start = other.scheduled_time
        other_end = other.end_time
        
        return not (self_end <= other_start or other_end <= self_start)
    
    def can_be_scheduled_at(self, start_time: datetime) -> bool:
        if self.fixed_time:
            return start_time == self.fixed_time
        
        if self.earliest_start and start_time < self.earliest_start:
            return False
        
        if self.latest_start and start_time > self.latest_start:
            return False
        
        return True
    
    def schedule_at(self, start_time: datetime) -> bool:
        if self.can_be_scheduled_at(start_time):
            self.scheduled_time = start_time
            return True
        return False
    
    def unschedule(self):
        self.scheduled_time = None
    
    def __str__(self) -> str:
        status = f"at {self.scheduled_time.strftime('%Y-%m-%d %H:%M')}" if self.is_scheduled else "unscheduled"
        return f"{self.title} ({self.duration}min, {self.priority.name}) - {status}"
    
    def __repr__(self) -> str:
        return f"Event('{self.title}', {self.duration}, {self.priority})"