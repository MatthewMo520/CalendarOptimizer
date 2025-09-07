import { Event } from '../types/Event';
import { format, addDays, setHours, setMinutes, parseISO } from 'date-fns';

interface ParsedEvent {
  event?: Partial<Event>;
  response?: string;
}

const TIME_PATTERNS = {
  // Time patterns
  time12: /\b(1[0-2]|0?[1-9]):?([0-5][0-9])?\s*(am|pm|a\.m\.|p\.m\.)\b/gi,
  time24: /\b([0-1]?[0-9]|2[0-3]):([0-5][0-9])\b/g,
  timeWords: /\b(morning|afternoon|evening|night|noon|midnight)\b/gi,
  
  // Duration patterns
  duration: /\b(\d+)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/gi,
  durationWords: /\b(half an hour|one hour|two hours|thirty minutes)\b/gi,
  
  // Day patterns
  days: /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|this week)\b/gi,
  
  // Priority patterns
  priority: /\b(urgent|important|high priority|low priority|asap|critical)\b/gi,
  
  // Event type patterns
  mandatory: /\b(class|lecture|mandatory|required|must attend|exam|test)\b/gi,
  flexible: /\b(study|work|practice|review|flexible|when possible)\b/gi,
  
  // Subject patterns
  subjects: /\b(math|mathematics|science|physics|chemistry|biology|english|history|computer science|programming|coding)\b/gi,
};

const PRIORITY_KEYWORDS = {
  high: ['urgent', 'important', 'high priority', 'asap', 'critical', 'exam', 'test', 'deadline'],
  medium: ['meeting', 'appointment', 'class', 'lecture'],
  low: ['study', 'review', 'practice', 'optional', 'flexible']
};

const DURATION_MAPPINGS = {
  'half an hour': 30,
  'one hour': 60,
  'two hours': 120,
  'thirty minutes': 30,
};

const TIME_MAPPINGS = {
  'morning': 9,
  'afternoon': 14,
  'evening': 18,
  'night': 20,
  'noon': 12,
  'midnight': 0,
};

export function parseNaturalLanguage(input: string, currentEvents: Event[]): ParsedEvent {
  const lowerInput = input.toLowerCase();
  
  try {
    // Extract event title (try to identify the main subject/activity)
    let title = extractTitle(lowerInput);
    
    // Extract duration
    const duration = extractDuration(lowerInput);
    
    // Extract time information
    const timeInfo = extractTimeInfo(lowerInput);
    
    // Determine priority
    const priority = extractPriority(lowerInput);
    
    // Determine event type (mandatory, flexible, fixed)
    const type = extractEventType(lowerInput);
    
    // If we couldn't extract basic info, return a helpful response
    if (!title || !duration) {
      return {
        response: "I need more information. Please specify:\n• What activity/event\n• Duration (e.g., '2 hours', '30 minutes')\n• Optionally: time preference"
      };
    }
    
    const event: Partial<Event> = {
      id: Date.now().toString(),
      title,
      duration,
      priority,
      type,
      isScheduled: false,
      ...timeInfo,
    };
    
    return { event };
    
  } catch (error) {
    return {
      response: "I had trouble understanding that. Could you try rephrasing? For example: 'Study math for 2 hours tomorrow morning'"
    };
  }
}

function extractTitle(input: string): string {
  // Look for activity keywords and build a meaningful title
  const activityPatterns = [
    /\b(study|studying)\s+(.*?)(?:\s+for|\s+\d+|$)/i,
    /\b(meeting|appointment)\s+with\s+(.*?)(?:\s+at|\s+for|\s+\d+|$)/i,
    /\b(class|lecture)\s+(?:on\s+)?(.*?)(?:\s+at|\s+for|\s+\d+|$)/i,
    /\b(practice|review|work on)\s+(.*?)(?:\s+for|\s+\d+|$)/i,
    /\b(.*?)\s+(?:session|time|break)(?:\s+for|\s+\d+|$)/i,
  ];
  
  for (const pattern of activityPatterns) {
    const match = input.match(pattern);
    if (match && match[1] && match[2]) {
      const activity = match[1].charAt(0).toUpperCase() + match[1].slice(1);
      const subject = match[2].charAt(0).toUpperCase() + match[2].slice(1);
      return `${activity} ${subject}`.trim();
    }
  }
  
  // Fallback: look for subjects and activities
  const subjects = input.match(TIME_PATTERNS.subjects);
  if (subjects && subjects[0]) {
    const activities = ['study', 'review', 'practice', 'work'];
    const foundActivity = activities.find(act => input.includes(act));
    if (foundActivity) {
      return `${foundActivity.charAt(0).toUpperCase() + foundActivity.slice(1)} ${subjects[0].charAt(0).toUpperCase() + subjects[0].slice(1)}`;
    }
    return `${subjects[0].charAt(0).toUpperCase() + subjects[0].slice(1)} Session`;
  }
  
  // Last resort: extract first meaningful word
  const words = input.split(' ').filter(word => 
    word.length > 2 && 
    !['for', 'the', 'and', 'with', 'at', 'on', 'in', 'to'].includes(word)
  );
  
  if (words.length > 0) {
    return words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  
  return 'New Event';
}

function extractDuration(input: string): number {
  // Check word-based durations first
  for (const [phrase, minutes] of Object.entries(DURATION_MAPPINGS)) {
    if (input.includes(phrase)) {
      return minutes;
    }
  }
  
  // Check numeric durations
  const matches = Array.from(input.matchAll(TIME_PATTERNS.duration));
  for (const match of matches) {
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    if (unit.startsWith('h')) {
      return value * 60; // hours to minutes
    } else if (unit.startsWith('m')) {
      return value; // already in minutes
    }
  }
  
  // Default duration based on activity type
  if (input.includes('class') || input.includes('lecture')) return 90;
  if (input.includes('meeting')) return 60;
  if (input.includes('study') || input.includes('review')) return 120;
  if (input.includes('break')) return 15;
  
  return 60; // Default 1 hour
}

function extractTimeInfo(input: string) {
  const today = new Date();
  const timeInfo: any = {};
  
  // Extract day information
  let targetDate = today;
  
  if (input.includes('tomorrow')) {
    targetDate = addDays(today, 1);
  } else if (input.includes('monday')) {
    targetDate = getNextWeekday(today, 1);
  } else if (input.includes('tuesday')) {
    targetDate = getNextWeekday(today, 2);
  } else if (input.includes('wednesday')) {
    targetDate = getNextWeekday(today, 3);
  } else if (input.includes('thursday')) {
    targetDate = getNextWeekday(today, 4);
  } else if (input.includes('friday')) {
    targetDate = getNextWeekday(today, 5);
  } else if (input.includes('saturday')) {
    targetDate = getNextWeekday(today, 6);
  } else if (input.includes('sunday')) {
    targetDate = getNextWeekday(today, 0);
  }
  
  // Extract specific times
  const timeMatches = input.match(TIME_PATTERNS.time12);
  if (timeMatches && timeMatches[0]) {
    const timeStr = timeMatches[0];
    const parsedTime = parseTimeString(timeStr);
    if (parsedTime) {
      const specificTime = setHours(setMinutes(targetDate, parsedTime.minutes), parsedTime.hours);
      timeInfo.fixedTime = specificTime.toISOString();
      return timeInfo;
    }
  }
  
  // Extract time words (morning, afternoon, etc.)
  const timeWords = input.match(TIME_PATTERNS.timeWords);
  if (timeWords && timeWords[0]) {
    const timeWord = timeWords[0].toLowerCase();
    const hour = TIME_MAPPINGS[timeWord as keyof typeof TIME_MAPPINGS];
    if (hour !== undefined) {
      const earliestTime = setHours(setMinutes(targetDate, 0), hour);
      const latestTime = setHours(setMinutes(targetDate, 0), hour + 3); // 3-hour window
      
      timeInfo.earliestStart = earliestTime.toISOString();
      timeInfo.latestStart = latestTime.toISOString();
      return timeInfo;
    }
  }
  
  // Default to today if no specific time mentioned
  const defaultStart = setHours(setMinutes(targetDate, 0), 9); // 9 AM
  const defaultEnd = setHours(setMinutes(targetDate, 0), 17); // 5 PM
  
  timeInfo.earliestStart = defaultStart.toISOString();
  timeInfo.latestStart = defaultEnd.toISOString();
  
  return timeInfo;
}

function extractPriority(input: string): 1 | 2 | 3 {
  const lowerInput = input.toLowerCase();
  
  for (const keyword of PRIORITY_KEYWORDS.high) {
    if (lowerInput.includes(keyword)) return 3;
  }
  
  for (const keyword of PRIORITY_KEYWORDS.medium) {
    if (lowerInput.includes(keyword)) return 2;
  }
  
  for (const keyword of PRIORITY_KEYWORDS.low) {
    if (lowerInput.includes(keyword)) return 1;
  }
  
  return 2; // Default to medium priority
}

function extractEventType(input: string): 'flexible' | 'fixed' | 'mandatory' {
  const lowerInput = input.toLowerCase();
  
  // Check for mandatory patterns
  if (TIME_PATTERNS.mandatory.test(lowerInput)) {
    return 'mandatory';
  }
  
  // Check for specific time mentions (indicates fixed time)
  if (TIME_PATTERNS.time12.test(lowerInput) || TIME_PATTERNS.time24.test(lowerInput)) {
    return 'fixed';
  }
  
  // Default to flexible
  return 'flexible';
}

function parseTimeString(timeStr: string): { hours: number; minutes: number } | null {
  const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?/i);
  if (!match) return null;
  
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2] || '0');
  const period = match[3]?.toLowerCase();
  
  if (period && (period.includes('pm') || period.includes('p.m.'))) {
    if (hours !== 12) hours += 12;
  } else if (period && (period.includes('am') || period.includes('a.m.')) && hours === 12) {
    hours = 0;
  }
  
  return { hours, minutes };
}

function getNextWeekday(date: Date, targetDay: number): Date {
  const currentDay = date.getDay();
  let daysToAdd = targetDay - currentDay;
  
  if (daysToAdd <= 0) {
    daysToAdd += 7; // Next occurrence of this weekday
  }
  
  return addDays(date, daysToAdd);
}