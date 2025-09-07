#!/usr/bin/env python3
from datetime import datetime, timedelta
from typing import List
from event import Event, Priority
from scheduler import Calendar
from optimizer import ScheduleOptimizer


def print_menu():
    print("\n=== Calendar AI Optimizer ===")
    print("1. Add custom event")
    print("2. Show current schedule")
    print("3. Optimize schedule")
    print("4. Show optimization report")
    print("5. Clear schedule")
    print("6. Exit")
    print("=" * 30)

def get_priority_input() -> Priority:
    while True:
        print("Priority levels:")
        print("1. Low")
        print("2. Medium")  
        print("3. High")
        try:
            choice = int(input("Select priority (1-3): "))
            if choice == 1:
                return Priority.LOW
            elif choice == 2:
                return Priority.MEDIUM
            elif choice == 3:
                return Priority.HIGH
            else:
                print("Invalid choice. Please enter 1, 2, or 3.")
        except ValueError:
            print("Please enter a valid number.")

def get_datetime_input(prompt: str) -> datetime:
    while True:
        try:
            date_str = input(f"{prompt} (YYYY-MM-DD HH:MM): ")
            return datetime.strptime(date_str, "%Y-%m-%d %H:%M")
        except ValueError:
            print("Invalid format. Please use YYYY-MM-DD HH:MM format.")

def add_custom_event(calendar: Calendar):
    print("\n--- Add Custom Event ---")
    title = input("Event title: ")
    
    try:
        duration = int(input("Duration in minutes: "))
    except ValueError:
        print("Invalid duration. Using default 60 minutes.")
        duration = 60
    
    priority = get_priority_input()
    
    fixed_choice = input("Is this a fixed-time event? (y/n): ").lower()
    
    if fixed_choice == 'y':
        fixed_time = get_datetime_input("Fixed time")
        event = Event(title, duration, priority, fixed_time=fixed_time)
    else:
        print("Enter time window for flexible scheduling:")
        earliest = get_datetime_input("Earliest start time")
        latest = get_datetime_input("Latest start time")
        event = Event(title, duration, priority, earliest, latest)
    
    calendar.add_event(event)
    print(f"Added event: {event}")

def main():
    # Initialize calendar for today
    today = datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)
    end_time = today.replace(hour=18)  # 8 AM to 6 PM workday
    
    calendar = Calendar(today, end_time)
    optimizer = ScheduleOptimizer(calendar)
    
    print("Welcome to Calendar AI Optimizer!")
    print(f"Calendar setup for: {today.strftime('%Y-%m-%d')} ({today.strftime('%H:%M')} - {end_time.strftime('%H:%M')})")
    
    while True:
        print_menu()
        
        try:
            choice = input("Enter your choice (1-6): ").strip()
            
            if choice == '1':
                # Add custom event
                add_custom_event(calendar)
                
            elif choice == '2':
                # Show current schedule
                print("\n" + "="*50)
                print(calendar.get_schedule_summary())
                print("="*50)
                
            elif choice == '3':
                # Optimize schedule
                print("\nOptimizing schedule...")
                success = optimizer.optimize_schedule()
                if success:
                    print("✓ Schedule optimized successfully!")
                else:
                    print("⚠ Some events could not be scheduled")
                
                # Try to resolve conflicts
                resolutions = optimizer.resolve_conflicts()
                if resolutions:
                    print("Conflict resolutions:")
                    for event1, event2, resolution in resolutions:
                        print(f"  - {resolution}")
                
            elif choice == '4':
                # Show optimization report
                print("\n" + "="*50)
                print(optimizer.get_optimization_report())
                print("="*50)
                
            elif choice == '5':
                # Clear schedule
                calendar.clear_schedule()
                print("Schedule cleared.")
                
            elif choice == '6':
                print("Thank you for using Calendar AI Optimizer!")
                break
                
            else:
                print("Invalid choice. Please enter a number between 1-6.")
                
        except KeyboardInterrupt:
            print("\nExiting...")
            break
        except Exception as e:
            print(f"An error occurred: {e}")

if __name__ == "__main__":
    main()