import React, { useState, useEffect } from 'react';
import { Calendar, Clock, BarChart3, AlertCircle } from 'lucide-react';
import { Event, CalendarData } from './types/Event';
import ChatBot from './components/ChatBot';
import EventForm from './components/EventForm';
import CalendarView from './components/CalendarView';
import EventsList from './components/EventsList';
import StatusBar from './components/StatusBar';
import ApiService from './services/api';

function App() {
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
    // Simple local optimization logic
    const optimized = [...events].sort((a, b) => b.priority - a.priority);
    let currentTime = new Date();
    currentTime.setHours(9, 0, 0, 0); // Start at 9 AM

    const scheduledEvents = optimized.map(event => {
      if (event.type === 'mandatory' || event.fixedTime) {
        return event; // Keep mandatory/fixed events as is
      }

      const scheduledEvent = { 
        ...event, 
        scheduledTime: currentTime.toISOString(),
        isScheduled: true 
      };
      
      currentTime = new Date(currentTime.getTime() + event.duration * 60000);
      return scheduledEvent;
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
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
        activeTab === id
          ? 'bg-primary-600 text-white shadow-lg'
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
              <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Calendar AI Optimizer</h1>
                <p className="text-sm text-gray-500">Smart scheduling for your busy life - Now live!</p>
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
                className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:block">Optimize</span>
              </button>
              
              <button
                onClick={handleClearSchedule}
                disabled={isLoading || events.length === 0}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
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
          {/* Sidebar - Event Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Event</h2>
              <EventForm onEventCreate={handleEventCreate} isLoading={isLoading} />
            </div>
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

export default App;