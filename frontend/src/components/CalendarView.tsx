import React from 'react';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { Clock, MapPin, AlertTriangle } from 'lucide-react';
import { Event } from '../types/Event';

interface CalendarViewProps {
  events: Event[];
  conflicts: Array<{
    event1: string;
    event2: string;
    event1Time?: string;
    event2Time?: string;
  }>;
  isLoading: boolean;
}

const CalendarView: React.FC<CalendarViewProps> = ({ events, conflicts, isLoading }) => {
  const today = new Date();
  const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfCurrentWeek, i));
  const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM

  const getEventsForTimeSlot = (day: Date, hour: number) => {
    return events.filter(event => {
      if (!event.scheduledTime) return false;
      
      const eventDate = parseISO(event.scheduledTime);
      const eventHour = eventDate.getHours();
      const eventEndHour = eventHour + Math.ceil(event.duration / 60);
      
      return isSameDay(eventDate, day) && eventHour <= hour && hour < eventEndHour;
    });
  };

  const getEventHeight = (duration: number) => {
    const hourHeight = 60; // Base height per hour
    const height = Math.max((duration / 60) * hourHeight, 40); // Minimum 40px
    return Math.min(height, 180); // Maximum 3 hours display
  };

  const getEventPosition = (scheduledTime: string) => {
    const eventDate = parseISO(scheduledTime);
    const minutes = eventDate.getMinutes();
    return (minutes / 60) * 60; // Position within the hour slot
  };

  const getPriorityColor = (priority: 1 | 2 | 3, type: string) => {
    if (type === 'mandatory') {
      return 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg';
    }
    
    switch (priority) {
      case 3: return 'bg-gradient-to-r from-red-400 to-pink-500 text-white';
      case 2: return 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white';
      case 1: return 'bg-gradient-to-r from-green-400 to-emerald-500 text-white';
      default: return 'bg-gradient-to-r from-blue-400 to-purple-500 text-white';
    }
  };

  const isEventInConflict = (eventTitle: string) => {
    return conflicts.some(conflict => 
      conflict.event1 === eventTitle || conflict.event2 === eventTitle
    );
  };

  const formatEventTime = (scheduledTime: string) => {
    const date = parseISO(scheduledTime);
    return format(date, 'HH:mm');
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-8 gap-2">
            {Array.from({ length: 64 }, (_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Weekly Calendar</h2>
        <p className="text-sm text-gray-600">
          {format(startOfCurrentWeek, 'MMM d')} - {format(addDays(startOfCurrentWeek, 6), 'MMM d, yyyy')}
        </p>
        
        {conflicts.length > 0 && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">{conflicts.length} conflict(s) detected</span>
            </div>
          </div>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-full">
          {/* Day Headers */}
          <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50">
            <div className="p-3 text-sm font-medium text-gray-600">Time</div>
            {weekDays.map((day, index) => (
              <div
                key={index}
                className={`p-3 text-center border-l border-gray-200 ${
                  isSameDay(day, today) 
                    ? 'bg-blue-50 text-blue-900 font-semibold' 
                    : 'text-gray-700'
                }`}
              >
                <div className="text-sm font-medium">{format(day, 'EEE')}</div>
                <div className={`text-lg ${isSameDay(day, today) ? 'text-blue-600' : ''}`}>
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>

          {/* Time Slots */}
          <div className="relative">
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b border-gray-100">
                {/* Time Label */}
                <div className="p-3 text-sm text-gray-500 font-medium bg-gray-50 border-r border-gray-200">
                  {format(new Date().setHours(hour, 0), 'HH:mm')}
                </div>

                {/* Day Columns */}
                {weekDays.map((day, dayIndex) => {
                  const slotEvents = getEventsForTimeSlot(day, hour);
                  
                  return (
                    <div
                      key={dayIndex}
                      className="relative border-l border-gray-200 min-h-[60px] p-1"
                      style={{ minHeight: '60px' }}
                    >
                      {slotEvents.map((event, eventIndex) => {
                        const isConflicted = isEventInConflict(event.title);
                        const eventStart = parseISO(event.scheduledTime!);
                        
                        // Only show event in the hour it starts
                        if (eventStart.getHours() !== hour) return null;
                        
                        return (
                          <div
                            key={`${event.id}-${eventIndex}`}
                            className={`absolute left-1 right-1 rounded-lg p-2 text-xs transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-pointer z-10 ${
                              getPriorityColor(event.priority, event.type)
                            } ${isConflicted ? 'ring-2 ring-red-400 ring-opacity-75' : ''}`}
                            style={{
                              top: `${getEventPosition(event.scheduledTime!)}px`,
                              height: `${getEventHeight(event.duration)}px`,
                            }}
                            title={`${event.title}\n${formatEventTime(event.scheduledTime!)} - ${event.duration}min\nPriority: ${['', 'Low', 'Medium', 'High'][event.priority]}\nType: ${event.type}`}
                          >
                            <div className="font-medium truncate">
                              {event.title}
                              {isConflicted && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                            </div>
                            <div className="flex items-center gap-1 mt-1 opacity-90">
                              <Clock className="w-3 h-3" />
                              <span>{formatEventTime(event.scheduledTime!)}</span>
                              <span>({event.duration}m)</span>
                            </div>
                            {event.location && (
                              <div className="flex items-center gap-1 mt-1 opacity-75">
                                <MapPin className="w-2 h-2" />
                                <span className="truncate text-xs">{event.location}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gradient-to-r from-red-500 to-red-600 rounded"></div>
            <span>Mandatory/High Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded"></div>
            <span>Medium Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded"></div>
            <span>Low Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3 h-3 text-red-500" />
            <span>Conflict</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;