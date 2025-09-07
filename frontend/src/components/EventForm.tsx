import React, { useState } from 'react';
import { Plus, Clock, Calendar as CalendarIcon, AlertTriangle } from 'lucide-react';
import { Event } from '../types/Event';

interface EventFormProps {
  onEventCreate: (event: Partial<Event>) => void;
  isLoading: boolean;
}

const EventForm: React.FC<EventFormProps> = ({ onEventCreate, isLoading }) => {
  const [formData, setFormData] = useState({
    title: '',
    duration: '60',
    priority: '2' as '1' | '2' | '3',
    type: 'flexible' as 'flexible' | 'fixed' | 'mandatory',
    description: '',
    location: '',
    earliestStart: '',
    latestStart: '',
    fixedTime: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Event title is required';
    }
    
    if (parseInt(formData.duration) < 15) {
      newErrors.duration = 'Duration must be at least 15 minutes';
    }
    
    if (formData.type === 'fixed' && !formData.fixedTime) {
      newErrors.fixedTime = 'Fixed time is required for fixed events';
    }
    
    if (formData.type === 'flexible') {
      if (!formData.earliestStart && !formData.latestStart) {
        // Set default times if not provided
        const now = new Date();
        const tomorrow9AM = new Date(now);
        tomorrow9AM.setDate(now.getDate() + 1);
        tomorrow9AM.setHours(9, 0, 0, 0);
        
        const tomorrow5PM = new Date(now);
        tomorrow5PM.setDate(now.getDate() + 1);
        tomorrow5PM.setHours(17, 0, 0, 0);
        
        formData.earliestStart = tomorrow9AM.toISOString().slice(0, 16);
        formData.latestStart = tomorrow5PM.toISOString().slice(0, 16);
      }
      
      if (formData.earliestStart && formData.latestStart) {
        const earliest = new Date(formData.earliestStart);
        const latest = new Date(formData.latestStart);
        
        if (earliest >= latest) {
          newErrors.latestStart = 'Latest start must be after earliest start';
        }
        
        const durationMs = parseInt(formData.duration) * 60 * 1000;
        if (latest.getTime() - earliest.getTime() < durationMs) {
          newErrors.latestStart = 'Time window too small for event duration';
        }
      }
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Create event object
    const eventData: Partial<Event> = {
      title: formData.title.trim(),
      duration: parseInt(formData.duration),
      priority: parseInt(formData.priority) as 1 | 2 | 3,
      type: formData.type,
      description: formData.description.trim() || undefined,
      location: formData.location.trim() || undefined,
    };
    
    if (formData.type === 'fixed' && formData.fixedTime) {
      eventData.fixedTime = new Date(formData.fixedTime).toISOString();
    } else if (formData.type === 'flexible') {
      if (formData.earliestStart) {
        eventData.earliestStart = new Date(formData.earliestStart).toISOString();
      }
      if (formData.latestStart) {
        eventData.latestStart = new Date(formData.latestStart).toISOString();
      }
    }
    
    onEventCreate(eventData);
    
    // Reset form
    setFormData({
      title: '',
      duration: '60',
      priority: '2',
      type: 'flexible',
      description: '',
      location: '',
      earliestStart: '',
      latestStart: '',
      fixedTime: '',
    });
    setErrors({});
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case '3': return 'text-red-600 bg-red-50 border-red-200';
      case '2': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case '1': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'mandatory': return 'text-red-600 bg-red-50 border-red-200';
      case 'fixed': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'flexible': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Event Title *
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => handleInputChange('title', e.target.value)}
          placeholder="e.g., Study Math, Team Meeting"
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
            errors.title ? 'border-red-300' : 'border-gray-300'
          }`}
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {errors.title}
          </p>
        )}
      </div>

      {/* Duration and Priority */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Duration (min) *
          </label>
          <input
            type="number"
            min="15"
            step="15"
            value={formData.duration}
            onChange={(e) => handleInputChange('duration', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
              errors.duration ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.duration && (
            <p className="mt-1 text-xs text-red-600">{errors.duration}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Priority
          </label>
          <select
            value={formData.priority}
            onChange={(e) => handleInputChange('priority', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${getPriorityColor(formData.priority)}`}
          >
            <option value="1">Low</option>
            <option value="2">Medium</option>
            <option value="3">High</option>
          </select>
        </div>
      </div>

      {/* Event Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Event Type
        </label>
        <select
          value={formData.type}
          onChange={(e) => handleInputChange('type', e.target.value as any)}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${getTypeColor(formData.type)}`}
        >
          <option value="flexible">Flexible - Can be rescheduled</option>
          <option value="fixed">Fixed - Specific time required</option>
          <option value="mandatory">Mandatory - Cannot be moved</option>
        </select>
      </div>

      {/* Time Configuration */}
      {formData.type === 'fixed' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <CalendarIcon className="w-4 h-4 inline mr-1" />
            Fixed Time *
          </label>
          <input
            type="datetime-local"
            value={formData.fixedTime}
            onChange={(e) => handleInputChange('fixedTime', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
              errors.fixedTime ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {errors.fixedTime && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {errors.fixedTime}
            </p>
          )}
        </div>
      )}

      {formData.type === 'flexible' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            <Clock className="w-4 h-4 inline mr-1" />
            Time Window (optional)
          </label>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Earliest Start</label>
              <input
                type="datetime-local"
                value={formData.earliestStart}
                onChange={(e) => handleInputChange('earliestStart', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Latest Start</label>
              <input
                type="datetime-local"
                value={formData.latestStart}
                onChange={(e) => handleInputChange('latestStart', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm ${
                  errors.latestStart ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.latestStart && (
                <p className="mt-1 text-xs text-red-600">{errors.latestStart}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description (optional)
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          placeholder="Additional notes or details..."
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
        />
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Location (optional)
        </label>
        <input
          type="text"
          value={formData.location}
          onChange={(e) => handleInputChange('location', e.target.value)}
          placeholder="e.g., Conference Room A, Online, Library"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
      >
        {isLoading ? (
          <>
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
            Adding Event...
          </>
        ) : (
          <>
            <Plus className="w-4 h-4" />
            Add Event
          </>
        )}
      </button>
    </form>
  );
};

export default EventForm;