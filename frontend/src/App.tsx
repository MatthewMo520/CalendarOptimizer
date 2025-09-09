import React, { useState, useEffect } from 'react';
import { Calendar, Clock, BarChart3, AlertCircle } from 'lucide-react';
import { Event, CalendarData } from './types/Event';
import ChatBot from './components/ChatBot';
import EventForm from './components/EventForm';
import CalendarView from './components/CalendarView';
import EventsList from './components/EventsList';
import StatusBar from './components/StatusBar';
import ScheduleUpload from './components/ScheduleUpload';
import ApiService from './services/api';
// Debug import for testing API key
import './utils/testApiKey';

function AppContent() {
  const [events, setEvents] = useState<Event[]>([]);
  const [calendarData, setCalendarData] = useState<CalendarData>({ events: [], conflicts: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'calendar' | 'events' | 'analytics'>('calendar');
  const [apiStatus, setApiStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  useEffect(() => {
    loadInitialData();
    checkApiConnection();
  }, []);

  const checkApiConnection = async () => {
    setApiStatus('checking');
    const isHealthy = await ApiService.healthCheck();
    setApiStatus(isHealthy ? 'connected' : 'disconnected');
  };

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const eventsData = await ApiService.getEvents();
      setEvents(eventsData);
      
      const conflicts = await ApiService.getConflicts();
      setCalendarData({ events: eventsData, conflicts });
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEventCreate = async (eventData: Partial<Event>) => {
    try {
      setIsLoading(true);
      const newEvent = await ApiService.createEvent({
        title: eventData.title || 'New Event',
        duration: eventData.duration || 60,
        priority: eventData.priority || 2,
        type: eventData.type || 'flexible',
        description: eventData.description,
        location: eventData.location,
        earliestStart: eventData.earliestStart,
        latestStart: eventData.latestStart,
        fixedTime: eventData.fixedTime,
        dayOfWeek: eventData.dayOfWeek,
      });

      if (newEvent) {
        const updatedEvents = [...events, newEvent];
        setEvents(updatedEvents);
        setCalendarData(prev => ({ ...prev, events: updatedEvents }));
      }
    } catch (error) {
      console.error('Failed to create event:', error);
      // Fallback to local creation if API fails
      const localEvent: Event = {
        id: Date.now().toString(),
        title: eventData.title || 'New Event',
        duration: eventData.duration || 60,
        priority: eventData.priority || 2,
        type: eventData.type || 'flexible',
        isScheduled: false,
        ...eventData,
      };
      const updatedEvents = [...events, localEvent];
      setEvents(updatedEvents);
      setCalendarData(prev => ({ ...prev, events: updatedEvents }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBatchEventCreate = async (eventsData: Partial<Event>[]) => {
    try {
      setIsLoading(true);
      const createdEvents: Event[] = [];

      for (const eventData of eventsData) {
        try {
          const newEvent = await ApiService.createEvent({
            title: eventData.title || 'New Event',
            duration: eventData.duration || 60,
            priority: eventData.priority || 2,
            type: eventData.type || 'flexible',
            description: eventData.description,
            location: eventData.location,
            earliestStart: eventData.earliestStart,
            latestStart: eventData.latestStart,
            fixedTime: eventData.fixedTime,
            dayOfWeek: eventData.dayOfWeek,
          });

          if (newEvent) {
            createdEvents.push(newEvent);
          }
        } catch (error) {
          console.error('Failed to create event:', error);
          // Fallback to local creation if API fails
          const localEvent: Event = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: eventData.title || 'New Event',
            duration: eventData.duration || 60,
            priority: eventData.priority || 2,
            type: eventData.type || 'flexible',
            isScheduled: false,
            ...eventData,
          };
          createdEvents.push(localEvent);
        }
      }

      if (createdEvents.length > 0) {
        const updatedEvents = [...events, ...createdEvents];
        setEvents(updatedEvents);
        setCalendarData(prev => ({ ...prev, events: updatedEvents }));
      }
    } catch (error) {
      console.error('Failed to create batch events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEventDelete = async (eventId: string) => {
    try {
      const success = await ApiService.deleteEvent(eventId);
      if (success || apiStatus === 'disconnected') {
        const updatedEvents = events.filter(e => e.id !== eventId);
        setEvents(updatedEvents);
        setCalendarData(prev => ({ ...prev, events: updatedEvents }));
      }
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  const handleOptimizeSchedule = async () => {
    try {
      setIsLoading(true);
      const optimizedData = await ApiService.optimizeSchedule();
      setEvents(optimizedData.events);
      setCalendarData(optimizedData);
    } catch (error) {
      console.error('Failed to optimize schedule:', error);
      // Fallback to local optimization
      localOptimize();
    } finally {
      setIsLoading(false);
    }
  };

  const localOptimize = () => {
    console.log('🎯 OPTIMIZATION STARTING');
    console.log('📋 All events:', events);
    
    // Enhanced local optimization logic with multi-day distribution
    const optimized = [...events].sort((a, b) => a.priority - b.priority); // Sort by priority (1=highest)
    
    // Separate fixed/recurring events from flexible events
    const fixedEvents = optimized.filter(event => event.type === 'mandatory' || event.fixedTime);
    const flexibleEvents = optimized.filter(event => event.type === 'flexible' && !event.fixedTime);
    
    console.log('📌 Fixed events:', fixedEvents);
    console.log('🔄 Flexible events:', flexibleEvents);
    
    const scheduledEvents: Event[] = [];
    
    // Handle fixed/recurring events first
    fixedEvents.forEach(event => {
      const scheduledEvent = { 
        ...event, 
        isScheduled: true 
      };

      // For recurring class events (with dayOfWeek + fixedTime), DON'T set scheduledTime
      if (event.dayOfWeek !== undefined && event.fixedTime) {
        scheduledEvents.push({ ...event, isScheduled: true, scheduledTime: undefined });
        return;
      }

      // For other fixed events (without dayOfWeek), set a specific scheduledTime
      if (event.fixedTime && typeof event.fixedTime === 'string' && event.dayOfWeek === undefined) {
        const timeMatch = event.fixedTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        if (timeMatch) {
          let [, hours, minutes, ampm] = timeMatch;
          let hour24 = parseInt(hours);
          
          if (ampm && ampm.toUpperCase() === 'PM' && hour24 !== 12) {
            hour24 += 12;
          } else if (ampm && ampm.toUpperCase() === 'AM' && hour24 === 12) {
            hour24 = 0;
          }

          const scheduleDate = new Date();
          scheduleDate.setHours(hour24, parseInt(minutes), 0, 0);
          scheduledEvent.scheduledTime = scheduleDate.toISOString();
        }
      }

      scheduledEvents.push(scheduledEvent);
    });
    
    // Handle flexible events - distribute across multiple days
    let currentDay = new Date();
    let currentHour = 9; // Start at 9 AM
    const workDayStart = 9; // 9 AM
    const workDayEnd = 18; // 6 PM
    const maxHoursPerDay = workDayEnd - workDayStart;
    
    console.log('📅 Starting flexible event scheduling on:', currentDay.toDateString(), 'at hour:', currentHour);
    
    flexibleEvents.forEach((event, index) => {
      console.log(`\n🔄 Processing flexible event ${index + 1}:`, event.title);
      const eventDurationHours = event.duration / 60;
      console.log(`   ⏱️ Duration: ${eventDurationHours} hours`);
      console.log(`   📅 Current day: ${currentDay.toDateString()}, hour: ${currentHour}`);
      
      // Check if event fits in current day
      if (currentHour + eventDurationHours > workDayEnd) {
        console.log(`   ⚠️ Event doesn't fit today, moving to next day`);
        // Move to next day
        currentDay = new Date(currentDay.getTime() + 24 * 60 * 60 * 1000);
        currentHour = workDayStart;
        
        // Skip weekends for work events
        while (currentDay.getDay() === 0 || currentDay.getDay() === 6) {
          console.log(`   ⏭️ Skipping weekend: ${currentDay.toDateString()}`);
          currentDay = new Date(currentDay.getTime() + 24 * 60 * 60 * 1000);
        }
        console.log(`   ✅ Moved to: ${currentDay.toDateString()}, hour: ${currentHour}`);
      }
      
      // Schedule the event
      const scheduleTime = new Date(currentDay);
      scheduleTime.setHours(currentHour, 0, 0, 0);
      
      const scheduledEvent = {
        ...event,
        scheduledTime: scheduleTime.toISOString(),
        isScheduled: true
      };
      
      console.log(`   📍 Scheduled "${event.title}" for: ${scheduleTime.toLocaleString()}`);
      scheduledEvents.push(scheduledEvent);
      
      // Advance time for next event (with some buffer)
      currentHour += Math.max(eventDurationHours, 0.5); // At least 30 min between events
      console.log(`   ⏰ Next event will start at hour: ${currentHour}`);
    });

    console.log('\n🎉 OPTIMIZATION COMPLETE');
    console.log('📊 Final scheduled events:', scheduledEvents);
    console.log('📈 Summary:', {
      total: scheduledEvents.length,
      fixed: scheduledEvents.filter(e => e.fixedTime || e.type === 'mandatory').length,
      flexible: scheduledEvents.filter(e => e.type === 'flexible' && !e.fixedTime).length,
      withDayOfWeek: scheduledEvents.filter(e => e.dayOfWeek !== undefined).length,
      withScheduledTime: scheduledEvents.filter(e => e.scheduledTime).length
    });

    setEvents(scheduledEvents);
    setCalendarData(prev => ({ ...prev, events: scheduledEvents }));
  };

  const handleClearSchedule = async () => {
    if (window.confirm('Are you sure you want to clear all events?')) {
      try {
        setIsLoading(true);
        const success = await ApiService.clearSchedule();
        if (success || apiStatus === 'disconnected') {
          setEvents([]);
          setCalendarData({ events: [], conflicts: [] });
        }
      } catch (error) {
        console.error('Failed to clear schedule:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const TabButton: React.FC<{ 
    id: 'calendar' | 'events' | 'analytics'; 
    icon: React.ReactNode; 
    label: string; 
  }> = ({ id, icon, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
        activeTab === id
          ? 'bg-blue-600 text-white'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {icon}
      <span className="hidden sm:block">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-md">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Schedule Manager</h1>
                <p className="text-sm text-gray-600">Intelligent calendar organization system</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* API Status Indicator */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  apiStatus === 'connected' ? 'bg-green-500' : 
                  apiStatus === 'disconnected' ? 'bg-red-500' : 'bg-yellow-500'
                }`}></div>
                <span className="text-sm text-gray-600 hidden sm:block">
                  {apiStatus === 'connected' ? 'Connected' : 
                   apiStatus === 'disconnected' ? 'Offline Mode' : 'Connecting...'}
                </span>
              </div>

              {/* Action Buttons */}
              <button
                onClick={handleOptimizeSchedule}
                disabled={isLoading || events.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:block">Optimize</span>
              </button>
              
              <button
                onClick={handleClearSchedule}
                disabled={isLoading || events.length === 0}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 pb-4">
            <TabButton id="calendar" icon={<Calendar className="w-4 h-4" />} label="Calendar" />
            <TabButton id="events" icon={<Clock className="w-4 h-4" />} label="Events" />
            <TabButton id="analytics" icon={<BarChart3 className="w-4 h-4" />} label="Analytics" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Event Form and Schedule Upload */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Event</h2>
              <EventForm onEventCreate={handleEventCreate} isLoading={isLoading} />
            </div>
            
            <ScheduleUpload onEventsExtracted={handleBatchEventCreate} />
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {activeTab === 'calendar' && (
              <CalendarView 
                events={events} 
                conflicts={calendarData.conflicts} 
                isLoading={isLoading}
              />
            )}
            
            {activeTab === 'events' && (
              <EventsList 
                events={events} 
                onEventDelete={handleEventDelete}
                isLoading={isLoading}
              />
            )}
            
            {activeTab === 'analytics' && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Schedule Analytics</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{events.length}</div>
                    <div className="text-sm text-blue-600">Total Events</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {events.filter(e => e.isScheduled).length}
                    </div>
                    <div className="text-sm text-green-600">Scheduled</div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {calendarData.conflicts?.length || 0}
                    </div>
                    <div className="text-sm text-red-600">Conflicts</div>
                  </div>
                </div>
                
                {calendarData.conflicts && calendarData.conflicts.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      Conflicts Detected
                    </h3>
                    <div className="space-y-2">
                      {calendarData.conflicts.map((conflict, index) => (
                        <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-800">
                            <span className="font-medium">{conflict.event1}</span> conflicts with{' '}
                            <span className="font-medium">{conflict.event2}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Status Bar */}
      <StatusBar 
        events={events}
        conflicts={calendarData.conflicts || []}
        apiStatus={apiStatus}
        isLoading={isLoading}
      />

      {/* Chatbot */}
      <ChatBot 
        onEventCreate={handleEventCreate}
        currentEvents={events}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            <span className="text-gray-700">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return <AppContent />;
}

export default App;