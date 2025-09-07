import React from 'react';
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Wifi, 
  WifiOff,
  Activity
} from 'lucide-react';
import { Event } from '../types/Event';

interface StatusBarProps {
  events: Event[];
  conflicts: Array<{
    event1: string;
    event2: string;
    event1Time?: string;
    event2Time?: string;
  }>;
  apiStatus: 'connected' | 'disconnected' | 'checking';
  isLoading: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({ events, conflicts, apiStatus, isLoading }) => {
  const scheduledEvents = events.filter(e => e.isScheduled);
  const unscheduledEvents = events.filter(e => !e.isScheduled);
  const mandatoryEvents = events.filter(e => e.type === 'mandatory');
  const highPriorityEvents = events.filter(e => e.priority === 3);

  const getSuccessRate = () => {
    if (events.length === 0) return 0;
    return Math.round((scheduledEvents.length / events.length) * 100);
  };

  const getStatusColor = () => {
    if (conflicts.length > 0) return 'text-red-600';
    if (unscheduledEvents.length > 0) return 'text-yellow-600';
    if (scheduledEvents.length === events.length && events.length > 0) return 'text-green-600';
    return 'text-gray-600';
  };

  const getStatusMessage = () => {
    if (isLoading) return 'Processing...';
    if (conflicts.length > 0) return `${conflicts.length} conflict(s) detected`;
    if (unscheduledEvents.length > 0) return `${unscheduledEvents.length} event(s) need scheduling`;
    if (events.length === 0) return 'No events added yet';
    return 'All events scheduled successfully';
  };

  const StatItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color?: string;
  }> = ({ icon, label, value, color = 'text-gray-600' }) => (
    <div className="flex items-center gap-2">
      <div className={color}>
        {icon}
      </div>
      <div>
        <div className={`text-sm font-medium ${color}`}>{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );

  return (
    <footer className="bg-white border-t border-gray-200 px-4 py-3">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          {/* Left side - Main Status */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 ${getStatusColor()}`}>
              {isLoading ? (
                <Activity className="w-4 h-4 animate-pulse" />
              ) : conflicts.length > 0 ? (
                <AlertTriangle className="w-4 h-4" />
              ) : unscheduledEvents.length > 0 ? (
                <Clock className="w-4 h-4" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">
                {getStatusMessage()}
              </span>
            </div>

            {/* API Connection Status */}
            <div className="flex items-center gap-1">
              {apiStatus === 'connected' ? (
                <Wifi className="w-3 h-3 text-green-500" />
              ) : apiStatus === 'disconnected' ? (
                <WifiOff className="w-3 h-3 text-red-500" />
              ) : (
                <div className="w-3 h-3 border border-yellow-500 border-t-transparent rounded-full animate-spin" />
              )}
              <span className="text-xs text-gray-500">
                {apiStatus === 'connected' ? 'Online' : 
                 apiStatus === 'disconnected' ? 'Offline' : 'Connecting...'}
              </span>
            </div>
          </div>

          {/* Right side - Statistics */}
          <div className="flex items-center gap-6">
            <StatItem
              icon={<Calendar className="w-4 h-4" />}
              label="Total Events"
              value={events.length}
            />
            
            <StatItem
              icon={<CheckCircle className="w-4 h-4" />}
              label="Scheduled"
              value={scheduledEvents.length}
              color={scheduledEvents.length === events.length && events.length > 0 ? 'text-green-600' : 'text-gray-600'}
            />

            {unscheduledEvents.length > 0 && (
              <StatItem
                icon={<Clock className="w-4 h-4" />}
                label="Pending"
                value={unscheduledEvents.length}
                color="text-yellow-600"
              />
            )}

            {conflicts.length > 0 && (
              <StatItem
                icon={<AlertTriangle className="w-4 h-4" />}
                label="Conflicts"
                value={conflicts.length}
                color="text-red-600"
              />
            )}

            {mandatoryEvents.length > 0 && (
              <StatItem
                icon={<AlertTriangle className="w-4 h-4" />}
                label="Mandatory"
                value={mandatoryEvents.length}
                color="text-purple-600"
              />
            )}

            {events.length > 0 && (
              <StatItem
                icon={<Activity className="w-4 h-4" />}
                label="Success Rate"
                value={`${getSuccessRate()}%`}
                color={getSuccessRate() === 100 ? 'text-green-600' : getSuccessRate() >= 75 ? 'text-yellow-600' : 'text-red-600'}
              />
            )}
          </div>
        </div>

        {/* Additional Info for Conflicts */}
        {conflicts.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="text-xs text-red-600">
              <span className="font-medium">Conflicts:</span>{' '}
              {conflicts.slice(0, 2).map((conflict, index) => (
                <span key={index}>
                  {conflict.event1} ↔ {conflict.event2}
                  {index < Math.min(conflicts.length - 1, 1) && ', '}
                </span>
              ))}
              {conflicts.length > 2 && (
                <span> and {conflicts.length - 2} more...</span>
              )}
            </div>
          </div>
        )}
      </div>
    </footer>
  );
};

export default StatusBar;