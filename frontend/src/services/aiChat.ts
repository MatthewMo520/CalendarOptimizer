import { Event } from '../types/Event';

interface AIResponse {
  message: string;
  hasEvent?: boolean;
  event?: Partial<Event>;
  events?: Partial<Event>[];
  action?: 'create_event' | 'create_multiple_events' | 'chat' | 'help';
}

class AIChatService {
  private apiKey: string | null = null;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor() {
    // Check for Google Gemini API key
    this.apiKey = process.env.REACT_APP_GEMINI_API_KEY || localStorage.getItem('gemini_api_key');
    
    // Debug logging to check if API key is loaded
    console.log('AIChatService initialized with Google Gemini');
    console.log('Environment Gemini API key exists:', !!process.env.REACT_APP_GEMINI_API_KEY);
    console.log('localStorage Gemini API key exists:', !!localStorage.getItem('gemini_api_key'));
    console.log('Final API key configured:', !!this.apiKey);
    console.log('Final API key length:', this.apiKey?.length);
    
    if (!this.apiKey) {
      console.warn('No Google Gemini API key found. Using fallback responses.');
    } else {
      console.log('Google Gemini API key found, AI responses enabled.');
    }
  }

  setApiKey(key: string) {
    this.apiKey = key;
    localStorage.setItem('gemini_api_key', key);
  }

  async chat(message: string, currentEvents: Event[] = [], conversationHistory: Array<{role: string, content: string}> = []): Promise<AIResponse> {
    // Fallback to rule-based system if no API key
    if (!this.apiKey) {
      return this.fallbackResponse(message, currentEvents);
    }

    try {
      const systemPrompt = this.buildSystemPrompt(currentEvents);
      
      // Build conversation context
      let conversationContext = systemPrompt + '\n\n';
      conversationHistory.forEach(msg => {
        conversationContext += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
      });
      conversationContext += `User: ${message}`;
      
      const response = await fetch(`${this.baseUrl}/gemini-1.5-flash:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: conversationContext
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const aiMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || 'I had trouble processing that.';
      
      // Parse the AI response for calendar events
      const parsedResponse = this.parseAIResponse(aiMessage, message);
      
      return {
        message: parsedResponse.message,
        hasEvent: parsedResponse.hasEvent,
        event: parsedResponse.event,
        action: parsedResponse.action,
      };

    } catch (error) {
      console.error('Gemini API Error:', error);
      return this.fallbackResponse(message, currentEvents);
    }
  }

  private buildSystemPrompt(currentEvents: Event[]): string {
    const now = new Date();
    const currentTime = now.toLocaleString();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
    const eventsContext = currentEvents.length > 0 
      ? `Current events in calendar: ${currentEvents.map(e => `"${e.title}" (${e.duration}min, priority ${e.priority})`).join(', ')}`
      : 'Calendar is currently empty';

    return `You are a friendly AI calendar assistant. 

CURRENT CONTEXT:
- Current time: ${currentTime}
- Today is: ${currentDay}
- ${eventsContext}

IMPORTANT: When users specify days of the week (Monday, Tuesday, Wednesday, etc.), you must handle them correctly:
- For "next Monday" or "this Monday" or just "Monday", set specific day properties
- Calculate the correct date for the requested day
- Don't default everything to "today"

CRITICAL: For requests like "everyday", "daily", "every weekday", create MULTIPLE events:
- "everyday" = 7 events (one for each day of the week)
- "every weekday" = 5 events (Monday through Friday)
- "every Monday and Wednesday" = 2 events

When a user wants to create calendar event(s), respond in this EXACT format:

For SINGLE event:
EVENT_DETECTED: {
  "title": "Event Name",
  "duration": 60,
  "priority": 2,
  "type": "flexible"
}

For MULTIPLE events (everyday/daily requests):
MULTIPLE_EVENTS_DETECTED: [
  {
    "title": "Event Name (Monday)",
    "duration": 60,
    "priority": 2,
    "type": "flexible",
    "dayOfWeek": 1
  },
  {
    "title": "Event Name (Tuesday)",
    "duration": 60,
    "priority": 2,
    "type": "flexible",
    "dayOfWeek": 2
  }
]

CRITICAL RULES FOR DATES:
- If user says "Wednesday", "next Wednesday", or "this Wednesday": set "dayOfWeek": 3
- If user says "Monday": set "dayOfWeek": 1  
- If user says "Tuesday": set "dayOfWeek": 2
- If user says "Thursday": set "dayOfWeek": 4
- If user says "Friday": set "dayOfWeek": 5
- If user says "Saturday": set "dayOfWeek": 6
- If user says "Sunday": set "dayOfWeek": 0
- If user specifies time like "2 PM" or "2:00 PM", set "fixedTime"
- dayOfWeek: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday

EXAMPLES:
- "Schedule meeting Wednesday at 2 PM" → dayOfWeek: 3, fixedTime: "2:00 PM" 
- "Add study session Thursday morning" → dayOfWeek: 4, fixedTime: "9:00 AM"
- "1 hour of leetcode everyday" → MULTIPLE_EVENTS_DETECTED with 7 events
- "Add flexible study time daily" → MULTIPLE_EVENTS_DETECTED with 7 events

Priority levels: 1=High, 2=Medium, 3=Low
Types: "flexible", "fixed", "mandatory"

IMPORTANT: Always respond with either EVENT_DETECTED: or MULTIPLE_EVENTS_DETECTED: followed by valid JSON. Never respond without one of these formats when creating events.

For general chat, just respond normally and conversationally. Be helpful, friendly, and engaging!`;
  }

  private parseAIResponse(aiResponse: string, originalMessage: string): AIResponse {
    // Check for multiple events first
    const multipleEventsMatch = aiResponse.match(/MULTIPLE_EVENTS_DETECTED:\s*(\[[\s\S]*?\])/);
    
    if (multipleEventsMatch) {
      try {
        const eventsData = JSON.parse(multipleEventsMatch[1]);
        const cleanMessage = aiResponse.replace(/MULTIPLE_EVENTS_DETECTED:[\s\S]*?\]/, '').trim();
        
        return {
          message: cleanMessage || `I've created ${eventsData.length} events for your request!`,
          hasEvent: true,
          events: eventsData.map((eventData: any, index: number) => ({
            id: (Date.now() + index).toString(),
            ...eventData,
            isScheduled: false,
          })),
          action: 'create_multiple_events',
        };
      } catch (e) {
        console.error('Failed to parse multiple events JSON:', e);
      }
    }
    
    // Check if AI detected a single event
    const eventMatch = aiResponse.match(/EVENT_DETECTED:\s*({[\s\S]*?})/);
    
    if (eventMatch) {
      try {
        const eventData = JSON.parse(eventMatch[1]);
        const cleanMessage = aiResponse.replace(/EVENT_DETECTED:[\s\S]*?}/, '').trim();
        
        return {
          message: cleanMessage || "I've extracted the event details from your message!",
          hasEvent: true,
          event: {
            id: Date.now().toString(),
            ...eventData,
            isScheduled: false,
          },
          action: 'create_event',
        };
      } catch (e) {
        console.error('Failed to parse event JSON:', e);
      }
    }

    return {
      message: aiResponse,
      hasEvent: false,
      action: 'chat',
    };
  }

  private fallbackResponse(message: string, currentEvents: Event[]): AIResponse {
    const lowerMessage = message.toLowerCase();

    // Simple fallback responses
    if (/^(hi|hello|hey)/.test(lowerMessage)) {
      return {
        message: "Hi! 👋 I'm your AI calendar assistant powered by Google Gemini. I can chat with you and help manage your schedule. (Note: Connect your Gemini API key in settings for full AI capabilities)",
        action: 'chat',
      };
    }

    if (/schedule|calendar|event|meeting|appointment/.test(lowerMessage)) {
      return {
        message: "I'd love to help you schedule that! Could you provide more details like duration and when you'd like it scheduled? (For full AI parsing, please add your Google Gemini API key in settings)",
        action: 'help',
      };
    }

    return {
      message: "I'm here to help with your calendar and chat! For the full AI experience, please add your Google Gemini API key in the settings.",
      action: 'chat',
    };
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

export default new AIChatService();