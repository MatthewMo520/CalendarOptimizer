import { Event } from '../types/Event';

interface AIResponse {
  message: string;
  hasEvent?: boolean;
  event?: Partial<Event>;
  action?: 'create_event' | 'chat' | 'help';
}

class AIChatService {
  private apiKey: string | null = null;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

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

  async chat(message: string, currentEvents: Event[] = []): Promise<AIResponse> {
    // Fallback to rule-based system if no API key
    if (!this.apiKey) {
      return this.fallbackResponse(message, currentEvents);
    }

    try {
      const systemPrompt = this.buildSystemPrompt(currentEvents);
      const fullPrompt = `${systemPrompt}\n\nUser: ${message}`;
      
      const response = await fetch(`${this.baseUrl}/models/gemini-1.5-flash-latest:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: fullPrompt
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
    const currentTime = new Date().toLocaleString();
    const eventsContext = currentEvents.length > 0 
      ? `Current events in calendar: ${currentEvents.map(e => `"${e.title}" (${e.duration}min, priority ${e.priority})`).join(', ')}`
      : 'Calendar is currently empty';

    return `You are a friendly AI calendar assistant. Current time: ${currentTime}

${eventsContext}

Your capabilities:
1. Have natural conversations about anything
2. Help create calendar events from natural language
3. Provide scheduling advice and time management tips

When a user wants to create a calendar event, respond in this EXACT format:
EVENT_DETECTED: {
  "title": "Event Name",
  "duration": 60,
  "priority": 2,
  "type": "flexible",
  "description": "Optional description"
}

Priority levels: 1=High, 2=Medium, 3=Low
Types: "flexible", "fixed", "mandatory"

For general chat, just respond normally and conversationally. Be helpful, friendly, and engaging!`;
  }

  private parseAIResponse(aiResponse: string, originalMessage: string): AIResponse {
    // Check if AI detected an event
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