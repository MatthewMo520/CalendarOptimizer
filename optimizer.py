from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from event import Event, Priority
from scheduler import Calendar

class ScheduleOptimizer:
    def __init__(self, calendar: Calendar):
        self.calendar = calendar
    
    def optimize_schedule(self) -> bool:
        self.calendar.clear_schedule()
        
        # Sort events by priority (high to low) then by constraints
        events_to_schedule = sorted(
            self.calendar.events,
            key=lambda e: (
                -e.priority.value,  # Higher priority first
                e.fixed_time is not None,  # Fixed events first
                e.earliest_start or datetime.min,  # Earlier constraints first
                -e.duration  # Longer events first
            )
        )
        
        successfully_scheduled = []
        failed_to_schedule = []
        
        for event in events_to_schedule:
            if self._schedule_event(event):
                successfully_scheduled.append(event)
            else:
                failed_to_schedule.append(event)
        
        return len(failed_to_schedule) == 0
    
    def _schedule_event(self, event: Event) -> bool:
        if event.fixed_time:
            return self._try_schedule_at_time(event, event.fixed_time)
        
        available_slots = self.calendar.find_available_slots(
            event.duration,
            event.earliest_start,
            event.latest_start
        )
        
        if not available_slots:
            return False
        
        # Try to schedule at the earliest available slot
        return self._try_schedule_at_time(event, available_slots[0])
    
    def _try_schedule_at_time(self, event: Event, start_time: datetime) -> bool:
        if not event.can_be_scheduled_at(start_time):
            return False
        
        if not self.calendar.is_time_available(start_time, event.duration):
            return False
        
        return event.schedule_at(start_time)
    
    def resolve_conflicts(self) -> List[Tuple[Event, Event, str]]:
        conflicts = self.calendar.get_conflicts()
        resolutions = []
        
        for event1, event2 in conflicts:
            resolution = self._resolve_conflict(event1, event2)
            if resolution:
                resolutions.append(resolution)
        
        return resolutions
    
    def _resolve_conflict(self, event1: Event, event2: Event) -> Optional[Tuple[Event, Event, str]]:
        # Priority-based resolution
        if event1.priority.value > event2.priority.value:
            return self._try_reschedule(event2, event1)
        elif event2.priority.value > event1.priority.value:
            return self._try_reschedule(event1, event2)
        else:
            # Same priority - try to reschedule the one with more flexibility
            if event1.fixed_time and not event2.fixed_time:
                return self._try_reschedule(event2, event1)
            elif event2.fixed_time and not event1.fixed_time:
                return self._try_reschedule(event1, event2)
            else:
                # Try to reschedule the later one
                if event1.scheduled_time > event2.scheduled_time:
                    return self._try_reschedule(event1, event2)
                else:
                    return self._try_reschedule(event2, event1)
    
    def _try_reschedule(self, event_to_move: Event, fixed_event: Event) -> Optional[Tuple[Event, Event, str]]:
        original_time = event_to_move.scheduled_time
        event_to_move.unschedule()
        
        # Find new slot for the event
        available_slots = self.calendar.find_available_slots(
            event_to_move.duration,
            event_to_move.earliest_start,
            event_to_move.latest_start
        )
        
        for slot in available_slots:
            if event_to_move.schedule_at(slot):
                return (event_to_move, fixed_event, f"Moved {event_to_move.title} to {slot.strftime('%H:%M')}")
        
        # If no slot found, restore original time
        event_to_move.schedule_at(original_time)
        return None
    
    def suggest_improvements(self) -> List[str]:
        suggestions = []
        
        # Check for gaps that could be better utilized
        scheduled = sorted(self.calendar.get_scheduled_events(), key=lambda e: e.scheduled_time)
        
        for i in range(len(scheduled) - 1):
            current_end = scheduled[i].end_time
            next_start = scheduled[i + 1].scheduled_time
            gap = (next_start - current_end).total_seconds() / 60
            
            if gap > 60:  # Gap longer than 1 hour
                suggestions.append(f"Large gap ({int(gap)} min) between {scheduled[i].title} and {scheduled[i+1].title}")
        
        # Check for unscheduled high-priority events
        unscheduled_high_priority = [
            event for event in self.calendar.get_unscheduled_events()
            if event.priority == Priority.HIGH
        ]
        
        if unscheduled_high_priority:
            suggestions.append(f"{len(unscheduled_high_priority)} high-priority events remain unscheduled")
        
        return suggestions
    
    def get_optimization_report(self) -> str:
        scheduled_count = len(self.calendar.get_scheduled_events())
        total_count = len(self.calendar.events)
        conflicts_count = len(self.calendar.get_conflicts())
        
        report = f"Optimization Report:\n"
        report += f"  Scheduled: {scheduled_count}/{total_count} events\n"
        report += f"  Conflicts: {conflicts_count}\n"
        report += f"  Success Rate: {(scheduled_count/total_count)*100:.1f}%\n"
        
        suggestions = self.suggest_improvements()
        if suggestions:
            report += f"\nSuggestions:\n"
            for suggestion in suggestions:
                report += f"  - {suggestion}\n"
        
        return report