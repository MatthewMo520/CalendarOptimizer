import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { 
  Clock, 
  MapPin, 
  Calendar as CalendarIcon, 
  Trash2, 
  AlertCircle, 
  CheckCircle,
  User,
  FileText
} from 'lucide-react';
import { Event } from '../types/Event';

interface EventsListProps {
  events: Event[];
  onEventDelete: (eventId: string) => void;
  isLoading: boolean;
}

const EventsList: React.FC<EventsListProps> = ({ events, onEventDelete, isLoading }) => {
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'unscheduled' | 'mandatory'>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'time' | 'title'>('priority');

  const filteredEvents = events.filter(event => {
    switch (filter) {
      case 'scheduled': return event.isScheduled;
      case 'unscheduled': return !event.isScheduled;
      case 'mandatory': return event.type === 'mandatory';
      default: return true;
    }
  });

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    switch (sortBy) {
      case 'priority':
        return b.priority - a.priority;
      case 'time':
        if (!a.scheduledTime && !b.scheduledTime) return 0;
        if (!a.scheduledTime) return 1;
        if (!b.scheduledTime) return -1;
        return new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime();
      case 'title':
        return a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });

  const getPriorityBadge = (priority: 1 | 2 | 3) => {
    const configs = {
      3: { label: 'High', color: 'bg-red-100 text-red-800 border-red-200' },
      2: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      1: { label: 'Low', color: 'bg-green-100 text-green-800 border-green-200' },
    };
    
    const config = configs[priority];
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getTypeBadge = (type: 'flexible' | 'fixed' | 'mandatory') => {
    const configs = {
      mandatory: { 
        label: 'Mandatory', 
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: <AlertCircle className="w-3 h-3" />
      },
      fixed: { 
        label: 'Fixed Time', 
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: <Clock className="w-3 h-3" />
      },
      flexible: { 
        label: 'Flexible', 
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: <CheckCircle className="w-3 h-3" />
      },
    };
    
    const config = configs[type];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${config.color}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  const formatScheduledTime = (scheduledTime?: string) => {
    if (!scheduledTime) return 'Not scheduled';
    
    try {
      const date = parseISO(scheduledTime);
      return format(date, 'MMM d, yyyy \'at\' HH:mm');
    } catch {
      return 'Invalid time';
    }
  };

  const handleDelete = (eventId: string, eventTitle: string) => {
    if (window.confirm(`Are you sure you want to delete "${eventTitle}"?`)) {
      onEventDelete(eventId);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="h-5 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Events List</h2>
            <p className="text-sm text-gray-600 mt-1">
              {events.length} total events • {events.filter(e => e.isScheduled).length} scheduled
            </p>
          </div>

          {/* Filters and Sorting */}
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="all">All Events</option>
              <option value="scheduled">Scheduled Only</option>
              <option value="unscheduled">Unscheduled Only</option>
              <option value="mandatory">Mandatory Only</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="priority">Sort by Priority</option>
              <option value="time">Sort by Time</option>
              <option value="title">Sort by Title</option>
            </select>
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="divide-y divide-gray-200">
        {sortedEvents.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No events found</h3>
            <p className="text-gray-600">
              {filter === 'all' 
                ? "Start by adding some events using the form or chatbot."
                : `No ${filter} events to display. Try changing the filter.`
              }
            </p>
          </div>
        ) : (
          sortedEvents.map((event) => (
            <div
              key={event.id}
              className="p-6 hover:bg-gray-50 transition-colors duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {/* Title and Badges */}
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-medium text-gray-900 truncate">
                      {event.title}
                    </h3>
                    {getPriorityBadge(event.priority)}
                    {getTypeBadge(event.type)}
                    {event.isScheduled && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                        <CheckCircle className="w-3 h-3" />
                        Scheduled
                      </span>
                    )}
                  </div>

                  {/* Event Details */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{event.duration} minutes</span>
                      </div>
                      
                      {event.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <CalendarIcon className="w-4 h-4" />
                      <span>{formatScheduledTime(event.scheduledTime)}</span>
                    </div>

                    {event.description && (
                      <div className="flex items-start gap-1 text-sm text-gray-600">
                        <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{event.description}</span>
                      </div>
                    )}

                    {/* Time Constraints for Flexible Events */}
                    {event.type === 'flexible' && (event.earliestStart || event.latestStart) && (
                      <div className="text-sm text-gray-500">
                        <span className="font-medium">Time window:</span>
                        {event.earliestStart && (
                          <span> from {format(parseISO(event.earliestStart), 'MMM d, HH:mm')}</span>
                        )}
                        {event.latestStart && (
                          <span> until {format(parseISO(event.latestStart), 'MMM d, HH:mm')}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleDelete(event.id, event.title)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                    title="Delete event"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary Footer */}
      {sortedEvents.length > 0 && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {sortedEvents.length} of {events.length} events
            </span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                {events.filter(e => e.isScheduled).length} scheduled
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                {events.filter(e => !e.isScheduled).length} pending
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsList;