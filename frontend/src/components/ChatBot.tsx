import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Sparkles, X, Plus } from 'lucide-react';
import { ChatMessage, Event } from '../types/Event';
import { parseNaturalLanguage } from '../utils/nlp';

interface ChatBotProps {
  onEventCreate: (event: Partial<Event>) => void;
  currentEvents: Event[];
}

const getPriorityText = (priority: 1 | 2 | 3 | undefined): string => {
  switch (priority) {
    case 1: return 'High';
    case 2: return 'Medium';
    case 3: return 'Low';
    default: return 'Medium';
  }
};

const ChatBot: React.FC<ChatBotProps> = ({ onEventCreate, currentEvents }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Initial greeting
      const welcomeMessage: ChatMessage = {
        id: '1',
        type: 'assistant',
        content: "Hi! I'm your calendar assistant. You can tell me about events you'd like to add. For example:\n\n• \"I need to study math for 2 hours tomorrow morning\"\n• \"Schedule a meeting with John at 3 PM\"\n• \"Add my chemistry class every Monday at 9 AM\"",
        timestamp: new Date().toISOString(),
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, messages.length]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI processing time
    setTimeout(() => {
      processMessage(inputValue);
      setIsTyping(false);
    }, 1000);
  };

  const processMessage = (message: string) => {
    const parsedEvent = parseNaturalLanguage(message, currentEvents);
    
    if (parsedEvent.event) {
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `I've parsed your request! Here's what I understand:\n\n📅 **${parsedEvent.event.title}**\n⏱️ Duration: ${parsedEvent.event.duration} minutes\n📊 Priority: ${getPriorityText(parsedEvent.event.priority || 2)}\n📝 Type: ${parsedEvent.event.type}\n\n${parsedEvent.event.type === 'fixed' && parsedEvent.event.fixedTime ? `⏰ Fixed time: ${new Date(parsedEvent.event.fixedTime).toLocaleString()}` : ''}\n${parsedEvent.event.earliestStart && parsedEvent.event.latestStart ? `📍 Time window: ${new Date(parsedEvent.event.earliestStart).toLocaleString()} - ${new Date(parsedEvent.event.latestStart).toLocaleString()}` : ''}\n\nWould you like me to add this to your calendar?`,
        timestamp: new Date().toISOString(),
        event: parsedEvent.event as Event,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } else {
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: parsedEvent.response || "I couldn't parse that as an event. Could you try rephrasing? For example:\n\n• \"Study session for 2 hours\"\n• \"Meeting with team at 3 PM tomorrow\"\n• \"Gym workout for 90 minutes\"",
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    }
  };

  const handleAddEvent = (event: Event) => {
    onEventCreate(event);
    
    const confirmationMessage: ChatMessage = {
      id: (Date.now() + 2).toString(),
      type: 'assistant',
      content: `✅ Great! I've added "${event.title}" to your calendar. You can optimize your schedule to find the best time slot for it!`,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, confirmationMessage]);
  };

  const getPriorityText = (priority: 1 | 2 | 3) => {
    switch (priority) {
      case 1: return 'Low';
      case 2: return 'Medium';
      case 3: return 'High';
      default: return 'Medium';
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 ${
          isOpen 
            ? 'bg-gray-600 hover:bg-gray-700' 
            : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
        }`}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-96 bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-40 animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 rounded-t-xl bg-gradient-to-r from-purple-600 to-blue-600">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-white" />
              <h3 className="font-semibold text-white">Calendar Assistant</h3>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg whitespace-pre-line ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white ml-4'
                      : 'bg-gray-100 text-gray-800 mr-4'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  {message.event && (
                    <button
                      onClick={() => handleAddEvent(message.event!)}
                      className="mt-2 flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-full text-xs hover:bg-green-700 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add to Calendar
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 p-3 rounded-lg mr-4">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Tell me about an event you'd like to add..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                disabled={isTyping}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isTyping}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatBot;