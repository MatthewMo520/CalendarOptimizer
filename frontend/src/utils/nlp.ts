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
    // First check if this is a greeting or casual conversation
    if (isConversational(lowerInput)) {
      return {
        response: getConversationalResponse(lowerInput)
      };
    }
    
    // Check if this looks like an event request
    if (!hasEventIndicators(lowerInput)) {
      return {
        response: "I'm here to help you schedule events! Try telling me something like:\n\n• \"Study math for 2 hours tomorrow\"\n• \"Meeting with John at 3 PM\"\n• \"Gym workout for 90 minutes\"\n• \"Important deadline review for 1 hour\"\n\nWhat would you like to schedule? 📅"
      };
    }
    
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
    if (!title || title === 'New Event' || !duration || duration === 60) {
      return {
        response: "I need more details to create your event. Please specify:\n• What activity/event (e.g., 'study math', 'team meeting')\n• Duration (e.g., '2 hours', '30 minutes')\n• Optionally: time preference (e.g., 'tomorrow morning', 'at 3 PM')"
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

function isConversational(input: string): boolean {
  const conversationalPatterns = [
    /^(hi|hello|hey|good morning|good afternoon|good evening|greetings)/,
    /^(how are you|what's up|how's it going|how do you do)/,
    /^(thanks|thank you|bye|goodbye|see you)/,
    /^(yes|no|ok|okay|sure|alright)$/,
    /^(help|what can you do|what do you do)/,
    // Questions and general conversation
    /^(what|why|when|where|who|how)/,
    /\b(tell me|explain|describe|what is|who is|how to)\b/,
    // General statements
    /^(i am|i'm|i feel|i think|i need|i want|i like|i love|i hate)/,
    /^(that's|that is|this is|it is|it's)/,
    // Weather, time, general topics
    /\b(weather|time|day|today|tomorrow|weekend)\b/,
    /\b(tired|stressed|busy|free|bored|excited|happy|sad)\b/,
  ];
  
  return conversationalPatterns.some(pattern => pattern.test(input));
}

function getConversationalResponse(input: string): string {
  const lowerInput = input.toLowerCase();
  
  // Greetings
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|greetings)/.test(lowerInput)) {
    const responses = [
      "Hi there! 👋 I'm your AI calendar assistant. I can chat with you and help manage your schedule!",
      "Hello! 😊 Great to see you! I'm here to help with your calendar and answer any questions.",
      "Hey! 👋 I'm your smart scheduling companion. What's on your mind today?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  // How are you
  if (/^(how are you|what's up|how's it going|how do you do)/.test(lowerInput)) {
    const responses = [
      "I'm doing fantastic, thanks for asking! 🤖 Ready to help you stay organized. How's your day going?",
      "I'm great! Just processed 1,247 calendar events today! 📅 How can I help you with your schedule?",
      "Feeling energetic and ready to tackle your scheduling needs! ⚡ What would you like to work on?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  // Feelings and emotions
  if (/\b(tired|stressed|busy|overwhelmed)\b/.test(lowerInput)) {
    return "I understand you're feeling overwhelmed! 😔 Let me help you organize your schedule to make things more manageable. Would you like me to help you plan some breaks or prioritize your tasks?";
  }
  
  if (/\b(excited|happy|great|awesome|good)\b/.test(lowerInput)) {
    return "That's wonderful to hear! 😊 I love your positive energy! Is there something exciting you'd like to add to your calendar?";
  }
  
  if (/\b(free|bored|nothing to do)\b/.test(lowerInput)) {
    return "Sounds like you have some free time! 🎯 That's perfect for planning ahead. Would you like to schedule some productive activities or maybe some self-care time?";
  }
  
  // Questions about time/weather/day
  if (/\b(what.*time|what.*day|what.*weather)\b/.test(lowerInput)) {
    const now = new Date();
    return `It's currently ${now.toLocaleString()}! 🕒 Perfect timing to plan your schedule. What would you like to work on?`;
  }
  
  // Personal statements
  if (/^(i am|i'm|i feel|i think|i need|i want|i like|i love)/.test(lowerInput)) {
    if (/\b(need|want).*help\b/.test(lowerInput)) {
      return "I'm here to help! 💪 Whether it's scheduling, planning, or just organizing your thoughts - what can I do for you?";
    }
    return "I hear you! 👂 Thanks for sharing that with me. Is there something I can help you schedule or plan around that?";
  }
  
  // Questions
  if (/^(what|why|when|where|who|how)/.test(lowerInput)) {
    if (/can you do|what do you do/.test(lowerInput)) {
      return "I'm an AI calendar assistant! 🤖 I can:\n\n✨ Chat with you about anything\n📅 Create calendar events from natural language\n🎯 Help prioritize your tasks\n⏰ Suggest optimal scheduling\n📊 Analyze your time patterns\n\nWhat interests you most?";
    }
    return "That's an interesting question! 🤔 I'm always curious to learn more. While I ponder that, is there anything you'd like to add to your calendar?";
  }
  
  // Thanks
  if (/^(thanks|thank you)/.test(lowerInput)) {
    const responses = [
      "You're so welcome! 😊 Happy to help anytime!",
      "My pleasure! 🌟 That's what I'm here for!",
      "Aww, you're too kind! ❤️ Anything else I can help with?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  // Goodbye
  if (/^(bye|goodbye|see you|cya|talk to you later)/.test(lowerInput)) {
    const responses = [
      "Goodbye! 👋 It was great chatting with you. Come back anytime!",
      "See you later! 🌟 Hope your schedule works out perfectly!",
      "Take care! 💫 Remember, I'm always here when you need help organizing your time!",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  // Default conversational response
  const responses = [
    "That's interesting! 💭 I enjoy our conversation. Is there anything you'd like to schedule while we chat?",
    "I love chatting with you! 😊 Feel free to tell me about your day or ask me to schedule something.",
    "Thanks for sharing! 🤗 I'm here for both conversation and calendar help - whatever you need!",
    "I hear you! 👂 What's on your mind? I can chat or help with scheduling - your choice!",
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

function hasEventIndicators(input: string): boolean {
  const eventIndicators = [
    // Activity verbs
    /\b(schedule|plan|add|create|book|set up|organize)\b/,
    // Activities
    /\b(study|work|meeting|appointment|class|lecture|practice|review|gym|workout|call|break|lunch|dinner)\b/,
    // Duration indicators
    /\b\d+\s*(hours?|hrs?|h|minutes?|mins?|m)\b/,
    /\b(half an hour|one hour|two hours|thirty minutes)\b/,
    // Time indicators
    /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|night)\b/,
    /\b(at\s+)?\d{1,2}:?\d{0,2}\s*(am|pm)/,
    // Common event phrases
    /\b(for\s+\d+|session|appointment|meeting|class)\b/,
  ];
  
  return eventIndicators.some(pattern => pattern.test(input));
}

function extractTitle(input: string): string {
  // Clean input and normalize
  const cleaned = input.toLowerCase().trim();
  
  // Enhanced activity patterns with better matching
  const activityPatterns = [
    /\b(study|studying)\s+(.*?)(?:\s+for|\s+\d+|\s+at|\s+tomorrow|\s+today|$)/i,
    /\b(meeting|appointment)\s+(?:with\s+)?(.*?)(?:\s+at|\s+for|\s+\d+|\s+tomorrow|\s+today|$)/i,
    /\b(class|lecture)\s+(?:on\s+|in\s+)?(.*?)(?:\s+at|\s+for|\s+\d+|\s+tomorrow|\s+today|$)/i,
    /\b(practice|review|work\s+on)\s+(.*?)(?:\s+for|\s+\d+|\s+tomorrow|\s+today|$)/i,
    /\b(gym|workout|exercise)\s*(.*?)(?:\s+for|\s+\d+|\s+tomorrow|\s+today|$)/i,
    /\b(call|phone|email)\s+(.*?)(?:\s+at|\s+for|\s+\d+|\s+tomorrow|\s+today|$)/i,
    /\b(.*?)\s+(?:session|class|meeting|appointment)(?:\s+for|\s+\d+|\s+tomorrow|\s+today|$)/i,
  ];
  
  for (const pattern of activityPatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1]) {
      const activity = match[1].trim();
      const subject = match[2] ? match[2].trim() : '';
      
      // Clean up the subject part
      const cleanSubject = subject.replace(/\b(for|at|tomorrow|today|morning|afternoon|evening|night|hours?|minutes?|mins?|hrs?|h|m)\b.*$/g, '').trim();
      
      if (cleanSubject) {
        const capitalizedActivity = activity.charAt(0).toUpperCase() + activity.slice(1);
        const capitalizedSubject = cleanSubject.charAt(0).toUpperCase() + cleanSubject.slice(1);
        return `${capitalizedActivity} ${capitalizedSubject}`.replace(/\s+/g, ' ').trim();
      } else {
        return activity.charAt(0).toUpperCase() + activity.slice(1) + ' Session';
      }
    }
  }
  
  // Try to find subject/topic
  const subjects = cleaned.match(TIME_PATTERNS.subjects);
  if (subjects && subjects[0]) {
    const subject = subjects[0];
    const activities = ['study', 'review', 'practice', 'work', 'learn'];
    const foundActivity = activities.find(act => cleaned.includes(act));
    
    if (foundActivity) {
      return `${foundActivity.charAt(0).toUpperCase() + foundActivity.slice(1)} ${subject.charAt(0).toUpperCase() + subject.slice(1)}`;
    }
    return `${subject.charAt(0).toUpperCase() + subject.slice(1)} Session`;
  }
  
  // Look for common event types
  const eventTypes = [
    { pattern: /\b(meeting|appointment|call|interview)\b/i, title: 'Meeting' },
    { pattern: /\b(workout|gym|exercise|fitness)\b/i, title: 'Workout' },
    { pattern: /\b(break|rest|lunch|dinner|breakfast)\b/i, title: 'Break' },
    { pattern: /\b(homework|assignment|project)\b/i, title: 'Homework' },
    { pattern: /\b(shopping|grocery|errands)\b/i, title: 'Shopping' },
  ];
  
  for (const eventType of eventTypes) {
    if (eventType.pattern.test(cleaned)) {
      return eventType.title;
    }
  }
  
  // Last resort: extract meaningful words
  const words = cleaned.split(' ').filter(word => 
    word.length > 2 && 
    !['for', 'the', 'and', 'with', 'at', 'on', 'in', 'to', 'a', 'an', 'is', 'are', 'was', 'were', 'hours', 'minutes', 'mins', 'hrs'].includes(word) &&
    !/^\d+$/.test(word) // exclude pure numbers
  );
  
  if (words.length > 0) {
    return words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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
    if (lowerInput.includes(keyword)) return 1; // 1 = High priority
  }
  
  for (const keyword of PRIORITY_KEYWORDS.medium) {
    if (lowerInput.includes(keyword)) return 2; // 2 = Medium priority
  }
  
  for (const keyword of PRIORITY_KEYWORDS.low) {
    if (lowerInput.includes(keyword)) return 3; // 3 = Low priority
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