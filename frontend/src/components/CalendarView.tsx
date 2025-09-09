import React, { useState } from 'react';
import { format, startOfWeek, addDays, isSameDay, parseISO, addWeeks, subWeeks } from 'date-fns';
import { Clock, MapPin, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  
  const today = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM

  const getEventsForTimeSlot = (day: Date, hour: number) => {
    return events.filter(event => {
      // Debug: Log every event we're checking
      console.log(`🔍 CHECKING EVENT: "${event.title}" for ${format(day, 'EEEE')} ${hour}:00`);
      console.log(`   📊 Event data:`, {
        hasScheduledTime: !!event.scheduledTime,
        hasDayOfWeek: event.dayOfWeek !== undefined,
        hasFixedTime: !!event.fixedTime,
        scheduledTime: event.scheduledTime,
        dayOfWeek: event.dayOfWeek,
        fixedTime: event.fixedTime,
        type: event.type,
        isScheduled: event.isScheduled
      });
      
      if (!event.scheduledTime && !event.dayOfWeek) {
        console.log(`   ❌ Skipping - no scheduledTime and no dayOfWeek`);
        return false;
      }
      
      // PRIORITY: Handle recurring events FIRST (classes with dayOfWeek and fixedTime)
      // These should use dayOfWeek logic even if they have scheduledTime
      if (event.dayOfWeek !== undefined && event.fixedTime) {
        const dayOfWeek = day.getDay();
        const targetDay = event.dayOfWeek;
        
        console.log(`🔍 Recurring event check - "${event.title}": Current day ${format(day, 'EEEE')} (${dayOfWeek}) vs Target day ${targetDay}`);
        
        // Convert to match: Sunday=0, Monday=1, etc.
        if (dayOfWeek !== targetDay) {
          console.log(`   ❌ Day mismatch - skipping`);
          return false;
        }
        
        // Parse the fixed time to get hour
        const timeMatch = event.fixedTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        if (timeMatch) {
          let [, hours, minutes, ampm] = timeMatch;
          let hour24 = parseInt(hours);
          
          if (ampm && ampm.toUpperCase() === 'PM' && hour24 !== 12) {
            hour24 += 12;
          } else if (ampm && ampm.toUpperCase() === 'AM' && hour24 === 12) {
            hour24 = 0;
          }
          
          const eventEndHour = hour24 + Math.ceil(event.duration / 60);
          return hour24 <= hour && hour < eventEndHour;
        }
        return false;
      }
      
      // Handle scheduled events (only if NO dayOfWeek is set)
      if (event.scheduledTime && event.dayOfWeek === undefined) {
        const eventDate = parseISO(event.scheduledTime);
        const eventHour = eventDate.getHours();
        const eventEndHour = eventHour + Math.ceil(event.duration / 60);
        
        return isSameDay(eventDate, day) && eventHour <= hour && hour < eventEndHour;
      }
      
      return false;
    });
  };

  const getEventHeight = (duration: number) => {
    const hourHeight = 60; // Base height per hour
    const height = Math.max((duration / 60) * hourHeight, 40); // Minimum 40px
    return Math.min(height, 180); // Maximum 3 hours display
  };

  const getEventPosition = (event: Event) => {
    if (event.fixedTime && event.dayOfWeek !== undefined) {
      // Parse fixed time to get minutes
      const timeMatch = event.fixedTime.match(/(\d{1,2}):(\d{2})/i);
      if (timeMatch) {
        const minutes = parseInt(timeMatch[2]);
        return (minutes / 60) * 60;
      }
      return 0;
    }
    if (event.scheduledTime) {
      const eventDate = parseISO(event.scheduledTime);
      const minutes = eventDate.getMinutes();
      return (minutes / 60) * 60;
    }
    return 0;
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

  const formatEventTime = (event: Event) => {
    if (event.fixedTime && event.dayOfWeek !== undefined) {
      // For recurring events, show the fixed time
      return event.fixedTime;
    }
    if (event.scheduledTime) {
      const date = parseISO(event.scheduledTime);
      return format(date, 'HH:mm');
    }
    return '';
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => 
      direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1)
    );
  };

  const goToToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Weekly Calendar</h2>
            <p className="text-sm text-gray-600">
              {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateWeek('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Previous week"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
            >
              Today
            </button>
            <button
              onClick={() => navigateWeek('next')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Next week"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        
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
                        
                        // For scheduled events, only show in the hour it starts
                        if (event.scheduledTime) {
                          const eventStart = parseISO(event.scheduledTime);
                          if (eventStart.getHours() !== hour) return null;
                        }
                        
                        // For recurring events, show in the correct hour based on fixedTime
                        if (event.dayOfWeek !== undefined && event.fixedTime) {
                          const timeMatch = event.fixedTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
                          if (timeMatch) {
                            let [, hours, minutes, ampm] = timeMatch;
                            let hour24 = parseInt(hours);
                            
                            if (ampm && ampm.toUpperCase() === 'PM' && hour24 !== 12) {
                              hour24 += 12;
                            } else if (ampm && ampm.toUpperCase() === 'AM' && hour24 === 12) {
                              hour24 = 0;
                            }
                            
                            if (hour24 !== hour) return null;
                          }
                        }
                        
                        return (
                          <div
                            key={`${event.id}-${eventIndex}`}
                            className={`absolute left-1 right-1 rounded-lg p-2 text-xs transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-pointer z-10 ${
                              getPriorityColor(event.priority, event.type)
                            } ${isConflicted ? 'ring-2 ring-red-400 ring-opacity-75' : ''}`}
                            style={{
                              top: `${getEventPosition(event)}px`,
                              height: `${getEventHeight(event.duration)}px`,
                            }}
                            title={`${event.title}\n${formatEventTime(event)} - ${event.duration}min\nPriority: ${['', 'Low', 'Medium', 'High'][event.priority]}\nType: ${event.type}`}
                          >
                            <div className="font-medium truncate">
                              {event.title}
                              {isConflicted && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                            </div>
                            <div className="flex items-center gap-1 mt-1 opacity-90">
                              <Clock className="w-3 h-3" />
                              <span>{formatEventTime(event)}</span>
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