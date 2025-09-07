from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from event import Event

class Calendar:
    def __init__(self, start_date: datetime, end_date: datetime):
        self.start_date = start_date
        self.end_date = end_date
        self.events: List[Event] = []
    
    def add_event(self, event: Event) -> bool:
        if event not in self.events:
            self.events.append(event)
            return True
        return False
    
    def remove_event(self, event: Event) -> bool:
        if event in self.events:
            event.unschedule()
            self.events.remove(event)
            return True
        return False
    
    def get_scheduled_events(self) -> List[Event]:
        return [event for event in self.events if event.is_scheduled]
    
    def get_unscheduled_events(self) -> List[Event]:
        return [event for event in self.events if not event.is_scheduled]
    
    def has_conflicts(self) -> bool:
        scheduled = self.get_scheduled_events()
        for i, event1 in enumerate(scheduled):
            for event2 in scheduled[i+1:]:
                if event1.conflicts_with(event2):
                    return True
        return False
    
    def get_conflicts(self) -> List[Tuple[Event, Event]]:
        conflicts = []
        scheduled = self.get_scheduled_events()
        for i, event1 in enumerate(scheduled):
            for event2 in scheduled[i+1:]:
                if event1.conflicts_with(event2):
                    conflicts.append((event1, event2))
        return conflicts
    
    def is_time_available(self, start_time: datetime, duration: int, exclude_event: Optional[Event] = None) -> bool:
        end_time = start_time + timedelta(minutes=duration)
        
        if start_time < self.start_date or end_time > self.end_date:
            return False
        
        for event in self.get_scheduled_events():
            if exclude_event and event == exclude_event:
                continue
                
            if not (end_time <= event.scheduled_time or start_time >= event.end_time):
                return False
        
        return True
    
    def find_available_slots(self, duration: int, earliest_start: Optional[datetime] = None, latest_start: Optional[datetime] = None) -> List[datetime]:
        if not earliest_start:
            earliest_start = self.start_date
        if not latest_start:
            latest_start = self.end_date - timedelta(minutes=duration)
        
        slots = []
        current_time = earliest_start
        
        while current_time <= latest_start:
            if self.is_time_available(current_time, duration):
                slots.append(current_time)
            current_time += timedelta(minutes=15)  # 15-minute increments
        
        return slots
    
    def get_schedule_summary(self) -> str:
        scheduled = sorted(self.get_scheduled_events(), key=lambda e: e.scheduled_time)
        unscheduled = self.get_unscheduled_events()
        
        summary = f"Calendar Schedule ({self.start_date.strftime('%Y-%m-%d')} to {self.end_date.strftime('%Y-%m-%d')}):\n\n"
        
        if scheduled:
            summary += "Scheduled Events:\n"
            for event in scheduled:
                summary += f"  {event}\n"
        
        if unscheduled:
            summary += f"\nUnscheduled Events ({len(unscheduled)}):\n"
            for event in unscheduled:
                summary += f"  {event}\n"
        
        conflicts = self.get_conflicts()
        if conflicts:
            summary += f"\nConflicts ({len(conflicts)}):\n"
            for event1, event2 in conflicts:
                summary += f"  {event1.title} conflicts with {event2.title}\n"
        
        return summary
    
    def clear_schedule(self):
        for event in self.events:
            event.unschedule()
    
    def __str__(self) -> str:
        return self.get_schedule_summary()