import React, { useState, useRef, useEffect } from 'react';
import { format, startOfWeek, addDays, isSameDay, parseISO, addWeeks, subWeeks } from 'date-fns';
import { Clock, MapPin, AlertTriangle, ChevronLeft, ChevronRight, Navigation } from 'lucide-react';
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('compact');
  
  const today = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  // Show business hours (6 AM to 11 PM) by default, with option to expand
  const businessHours = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM to 11 PM
  const allHours = Array.from({ length: 24 }, (_, i) => i); // All 24 hours
  const hours = viewMode === 'compact' ? businessHours : allHours;

  // Helper function to extract dayOfWeek from event title if missing
  const getDayOfWeekFromTitle = (title: string): number | undefined => {
    const titleUpper = title.toUpperCase();
    if (titleUpper.includes('(SUNDAY)')) return 0;
    if (titleUpper.includes('(MONDAY)')) return 1;
    if (titleUpper.includes('(TUESDAY)')) return 2;
    if (titleUpper.includes('(WEDNESDAY)')) return 3;
    if (titleUpper.includes('(THURSDAY)')) return 4;
    if (titleUpper.includes('(FRIDAY)')) return 5;
    if (titleUpper.includes('(SATURDAY)')) return 6;
    return undefined;
  };

  const getEventsForTimeSlot = (day: Date, hour: number) => {
    return events.filter(event => {
      // Debug: Log every event we're checking
      console.log(`🔍 CHECKING EVENT: "${event.title}" for ${format(day, 'EEEE')} ${hour}:00`);
      
      // Try to get dayOfWeek from event data, or extract from title as fallback
      let eventDayOfWeek = event.dayOfWeek;
      if (eventDayOfWeek === undefined) {
        eventDayOfWeek = getDayOfWeekFromTitle(event.title);
        console.log(`   🔄 Extracted dayOfWeek from title: ${eventDayOfWeek}`);
      }
      
      console.log(`   📊 Event data:`, {
        hasScheduledTime: !!event.scheduledTime,
        hasDayOfWeek: event.dayOfWeek !== undefined,
        extractedDayOfWeek: eventDayOfWeek,
        hasFixedTime: !!event.fixedTime,
        scheduledTime: event.scheduledTime,
        dayOfWeek: event.dayOfWeek,
        fixedTime: event.fixedTime,
        type: event.type,
        isScheduled: event.isScheduled
      });
      
      if (!event.scheduledTime && eventDayOfWeek === undefined) {
        console.log(`   ❌ Skipping - no scheduledTime and no dayOfWeek`);
        return false;
      }
      
      // PRIORITY: Handle recurring events FIRST (classes with dayOfWeek and fixedTime)
      // These should use dayOfWeek logic even if they have scheduledTime
      if (eventDayOfWeek !== undefined && event.fixedTime) {
        const dayOfWeek = day.getDay();
        const targetDay = eventDayOfWeek;
        
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
      // Note: If dayOfWeek exists, ignore scheduledTime as it may be incorrect
      if (event.scheduledTime && eventDayOfWeek === undefined) {
        const eventDate = parseISO(event.scheduledTime);
        const eventHour = eventDate.getHours();
        const eventEndHour = eventHour + Math.ceil(event.duration / 60);
        
        return isSameDay(eventDate, day) && eventHour <= hour && hour < eventEndHour;
      }
      
      return false;
    });
  };

  const getEventHeight = (duration: number) => {
    const hourHeight = viewMode === 'compact' ? 50 : 60; // Smaller height in compact mode
    const height = Math.max((duration / 60) * hourHeight, 40); // Minimum 40px
    return Math.min(height, 150); // Maximum display height
  };

  const getEventPosition = (event: Event) => {
    const eventDayOfWeek = event.dayOfWeek ?? getDayOfWeekFromTitle(event.title);
    
    if (event.fixedTime && eventDayOfWeek !== undefined) {
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
      return 'bg-red-600 text-white border-red-700';
    }
    
    switch (priority) {
      case 3: return 'bg-red-500 text-white border-red-600'; // High priority
      case 2: return 'bg-orange-500 text-white border-orange-600'; // Medium priority
      case 1: return 'bg-blue-500 text-white border-blue-600'; // Low priority
      default: return 'bg-gray-500 text-white border-gray-600';
    }
  };

  const isEventInConflict = (eventTitle: string) => {
    return conflicts.some(conflict => 
      conflict.event1 === eventTitle || conflict.event2 === eventTitle
    );
  };

  const formatEventTime = (event: Event) => {
    const eventDayOfWeek = event.dayOfWeek ?? getDayOfWeekFromTitle(event.title);
    
    if (event.fixedTime && eventDayOfWeek !== undefined) {
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

  const scrollToCurrentTime = () => {
    if (scrollContainerRef.current) {
      const currentHour = new Date().getHours();
      const hourElement = scrollContainerRef.current.querySelector(`[data-hour="${currentHour}"]`);
      if (hourElement) {
        hourElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
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
    <div className="bg-white border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-medium text-gray-900 mb-1">Weekly Schedule</h1>
            <p className="text-sm text-gray-600">
              {format(currentWeekStart, 'MMMM d')} - {format(addDays(currentWeekStart, 6), 'MMMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateWeek('prev')}
              className="p-2 hover:bg-gray-50 transition-colors"
              title="Previous week"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-sm font-medium border border-gray-300"
            >
              Today
            </button>
            <button
              onClick={scrollToCurrentTime}
              className="p-2 hover:bg-gray-50 transition-colors"
              title="Go to current time"
            >
              <Navigation className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => navigateWeek('next')}
              className="p-2 hover:bg-gray-50 transition-colors"
              title="Next week"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
        
        {conflicts.length > 0 && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">{conflicts.length} scheduling conflict{conflicts.length > 1 ? 's' : ''}</span>
            </div>
          </div>
        )}
      </div>

      {/* View Options */}
      <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 font-medium">Hours:</span>
            <div className="flex border border-gray-300 bg-white">
              <button
                onClick={() => setViewMode('compact')}
                className={`px-3 py-1 text-sm font-medium transition-colors ${
                  viewMode === 'compact'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Business (6AM-11PM)
              </button>
              <button
                onClick={() => setViewMode('detailed')}
                className={`px-3 py-1 text-sm font-medium transition-colors border-l border-gray-300 ${
                  viewMode === 'detailed'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                All Day (24hr)
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {events.length} event{events.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto max-h-[700px] overflow-y-auto" ref={scrollContainerRef}>
        <div className="min-w-full">
          {/* Day Headers */}
          <div className="grid grid-cols-8 border-b border-gray-200 bg-white sticky top-0 z-20">
            <div className="p-3 text-sm font-medium text-gray-600 border-r border-gray-200">Time</div>
            {weekDays.map((day, index) => (
              <div
                key={index}
                className={`p-3 text-center border-l border-gray-200 ${
                  isSameDay(day, today) 
                    ? 'bg-blue-50 text-blue-900 font-medium' 
                    : 'text-gray-700'
                }`}
              >
                <div className="text-sm font-medium">{format(day, 'EEE')}</div>
                <div className={`text-base ${isSameDay(day, today) ? 'text-blue-700 font-medium' : 'text-gray-900'}`}>
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>

          {/* Time Slots */}
          <div className="relative">
            {hours.map((hour) => {
              const isCurrentHour = new Date().getHours() === hour && isSameDay(new Date(), today);
              
              return (
                <div key={hour} className={`grid grid-cols-8 border-b border-gray-100 ${isCurrentHour ? 'bg-blue-50' : ''}`} data-hour={hour}>
                  {/* Time Label */}
                  <div className={`p-3 text-sm font-medium border-r border-gray-200 ${
                    isCurrentHour ? 'bg-blue-100 text-blue-700' : 'text-gray-500 bg-gray-50'
                  }`}>
                    {hour === 0 ? '12:00 AM' : 
                     hour < 12 ? `${hour}:00 AM` : 
                     hour === 12 ? '12:00 PM' : 
                     `${hour - 12}:00 PM`}
                  </div>

                {/* Day Columns */}
                {weekDays.map((day, dayIndex) => {
                  const slotEvents = getEventsForTimeSlot(day, hour);
                  
                  return (
                    <div
                      key={dayIndex}
                      className={`relative border-l border-gray-200 p-0.5 ${
                        viewMode === 'compact' ? 'min-h-[50px]' : 'min-h-[60px]'
                      }`}
                      style={{ minHeight: viewMode === 'compact' ? '50px' : '60px' }}
                    >
                      {slotEvents.map((event, eventIndex) => {
                        const isConflicted = isEventInConflict(event.title);
                        
                        // For scheduled events, only show in the hour it starts
                        if (event.scheduledTime) {
                          const eventStart = parseISO(event.scheduledTime);
                          if (eventStart.getHours() !== hour) return null;
                        }
                        
                        // For recurring events, show in the correct hour based on fixedTime
                        const eventDayOfWeek = event.dayOfWeek ?? getDayOfWeekFromTitle(event.title);
                        if (eventDayOfWeek !== undefined && event.fixedTime) {
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
                            className={`absolute left-0.5 right-0.5 p-2 text-xs transition-all duration-200 hover:shadow-sm cursor-pointer z-10 overflow-hidden border-l-4 ${
                              getPriorityColor(event.priority, event.type)
                            } ${isConflicted ? 'ring-1 ring-red-500' : ''}`}
                            style={{
                              top: `${getEventPosition(event)}px`,
                              height: `${getEventHeight(event.duration)}px`,
                              minHeight: viewMode === 'compact' ? '40px' : '50px'
                            }}
                            title={`${event.title}\n${formatEventTime(event)} - ${event.duration}min\nPriority: ${['', 'Low', 'Medium', 'High'][event.priority]}\nType: ${event.type}${event.location ? '\nLocation: ' + event.location : ''}`}
                          >
                            <div className={`font-medium break-words mb-1 ${
                              viewMode === 'compact' ? 'text-xs leading-tight' : 'text-sm leading-tight'
                            }`} style={{
                              display: '-webkit-box',
                              WebkitLineClamp: viewMode === 'compact' ? 2 : 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}>
                              {event.title}
                              {isConflicted && <AlertTriangle className="w-3 h-3 inline ml-0.5 flex-shrink-0" />}
                            </div>
                            <div className={`flex items-center gap-1 opacity-90 flex-wrap mb-1 ${
                              viewMode === 'compact' ? 'text-xs' : 'text-xs'
                            }`}>
                              <Clock className="w-3 h-3 flex-shrink-0" />
                              <span className="whitespace-nowrap">{formatEventTime(event)}</span>
                              <span className="whitespace-nowrap">({event.duration}m)</span>
                            </div>
                            {event.location && (
                              <div className="flex items-center gap-1 opacity-80 text-xs">
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{event.location}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-600 border border-red-700"></div>
            <span>Mandatory/High</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 border border-orange-600"></div>
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 border border-blue-600"></div>
            <span>Low Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3 h-3 text-red-600" />
            <span>Conflict</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;