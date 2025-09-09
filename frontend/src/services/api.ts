import axios from 'axios';
import { Event, CalendarData } from '../types/Event';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface CreateEventRequest {
  title: string;
  duration: number;
  priority: 1 | 2 | 3;
  type: 'flexible' | 'fixed' | 'mandatory';
  description?: string;
  location?: string;
  earliestStart?: string;
  latestStart?: string;
  fixedTime?: string;
  dayOfWeek?: number; // 0=Sunday, 1=Monday, etc.
  recurringPattern?: {
    type: 'daily' | 'weekly' | 'monthly';
    days?: number[];
    endDate?: string;
  };
}

export interface ChatRequest {
  message: string;
  context?: {
    currentEvents: Event[];
    timeRange: {
      start: string;
      end: string;
    };
  };
}

export interface ChatResponse {
  reply: string;
  suggestedEvent?: CreateEventRequest;
  action?: 'create_event' | 'modify_schedule' | 'info';
}

class ApiService {
  // Event Management
  async getEvents(): Promise<Event[]> {
    try {
      const response = await api.get('/events');
      return response.data.events || [];
    } catch (error) {
      console.error('Failed to fetch events:', error);
      return [];
    }
  }

  async createEvent(event: CreateEventRequest): Promise<Event | null> {
    try {
      const response = await api.post('/events', event);
      return response.data.event;
    } catch (error) {
      console.error('Failed to create event:', error);
      throw error;
    }
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      await api.delete(`/events/${eventId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete event:', error);
      return false;
    }
  }

  async updateEvent(eventId: string, updates: Partial<CreateEventRequest>): Promise<Event | null> {
    try {
      const response = await api.put(`/events/${eventId}`, updates);
      return response.data.event;
    } catch (error) {
      console.error('Failed to update event:', error);
      return null;
    }
  }

  // Schedule Optimization
  async optimizeSchedule(): Promise<CalendarData> {
    try {
      const response = await api.post('/optimize');
      return {
        events: response.data.events || [],
        conflicts: response.data.conflicts || [],
        optimizationReport: response.data.report
      };
    } catch (error) {
      console.error('Failed to optimize schedule:', error);
      throw error;
    }
  }

  async clearSchedule(): Promise<boolean> {
    try {
      await api.delete('/events/clear');
      return true;
    } catch (error) {
      console.error('Failed to clear schedule:', error);
      return false;
    }
  }

  // Utility Methods
  async getConflicts(): Promise<CalendarData['conflicts']> {
    try {
      const response = await api.get('/conflicts');
      return response.data.conflicts || [];
    } catch (error) {
      console.error('Failed to fetch conflicts:', error);
      return [];
    }
  }

  async getAvailableSlots(duration: number, earliestStart?: string, latestStart?: string) {
    try {
      const params = new URLSearchParams({
        duration: duration.toString(),
        ...(earliestStart && { earliest_start: earliestStart }),
        ...(latestStart && { latest_start: latestStart }),
      });
      
      const response = await api.get(`/available-slots?${params}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch available slots:', error);
      return { slots: [], count: 0 };
    }
  }

  async getScheduleSummary(): Promise<string> {
    try {
      const response = await api.get('/schedule/summary');
      return response.data.summary;
    } catch (error) {
      console.error('Failed to fetch schedule summary:', error);
      return 'Failed to load schedule summary';
    }
  }

  // Chatbot API
  async sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
    try {
      const response = await api.post('/chat', request);
      return response.data;
    } catch (error) {
      console.error('Failed to send chat message:', error);
      throw error;
    }
  }

  // Health Check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await api.get('/health');
      return response.data.status === 'healthy';
    } catch (error) {
      return false;
    }
  }
}

export default new ApiService();