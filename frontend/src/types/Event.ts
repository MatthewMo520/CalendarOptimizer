export interface Event {
  id: string;
  title: string;
  duration: number; // in minutes
  priority: 1 | 2 | 3; // 1 = low, 2 = medium, 3 = high
  type: 'flexible' | 'fixed' | 'mandatory';
  scheduledTime?: string; // ISO string
  earliestStart?: string; // ISO string
  latestStart?: string; // ISO string
  fixedTime?: string; // ISO string
  isScheduled: boolean;
  description?: string;
  location?: string;
  color?: string;
  recurringPattern?: {
    type: 'daily' | 'weekly' | 'monthly';
    days?: number[]; // 0-6 for days of week
    endDate?: string;
  };
}

export interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
}

export interface CalendarData {
  events: Event[];
  conflicts: Array<{
    event1: string;
    event2: string;
    event1Time?: string;
    event2Time?: string;
  }>;
  optimizationReport?: {
    scheduledCount: number;
    totalCount: number;
    conflictsCount: number;
    successRate: number;
    suggestions: string[];
  };
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  event?: Event;
}