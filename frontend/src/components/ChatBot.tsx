import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { ChatMessage, Event } from '../types/Event';
import AIChatService from '../services/aiChat';

interface ChatBotProps {
  onEventCreate: (event: Partial<Event>) => void;
  onMultipleEventsCreate?: (events: Partial<Event>[]) => void;
  currentEvents: Event[];
}

const ChatBot: React.FC<ChatBotProps> = ({ onEventCreate, onMultipleEventsCreate, currentEvents }) => {
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
    // Add welcome message when first opened
    if (isOpen && messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        type: 'assistant',
        content: "Hi! I'm your AI calendar assistant. I can help you schedule events using natural language. Try saying things like:\n\n• \"Schedule a meeting with John for 1 hour tomorrow\"\n• \"I need to study math for 2 hours\"\n• \"Add my chemistry class every Monday at 9 AM\"",
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
    const messageToProcess = inputValue;
    setInputValue('');
    setIsTyping(true);

    // Add slight delay for better UX
    setTimeout(async () => {
      await processMessage(messageToProcess);
      setIsTyping(false);
    }, 800);
  };

  const processMessage = async (message: string) => {
    try {
      // Build conversation history from messages
      const conversationHistory = messages
        .slice(-10) // Keep last 10 messages for context
        .map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));
      
      const aiResponse = await AIChatService.chat(message, currentEvents, conversationHistory);
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: aiResponse.message,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Handle event creation
      console.log('AI Response:', aiResponse);
      if (aiResponse.hasEvent) {
        if (aiResponse.action === 'create_multiple_events' && aiResponse.events) {
          // Handle multiple events
          console.log('Creating multiple events:', aiResponse.events);
          if (onMultipleEventsCreate) {
            onMultipleEventsCreate(aiResponse.events);
          } else {
            // Fallback: create events one by one
            aiResponse.events.forEach(event => onEventCreate(event));
          }
        } else if (aiResponse.event) {
          // Handle single event
          console.log('Creating single event:', aiResponse.event);
          onEventCreate(aiResponse.event);
        }
      } else {
        console.log('No event detected in AI response');
      }

    } catch (error) {
      console.error('AI Chat error:', error);
      
      // Fallback response
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'I had trouble understanding that. Could you try rephrasing? For example:\n• "Schedule a 1 hour meeting"\n• "I need to study for 2 hours"',
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, errorMessage]);
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
      {/* Chat Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-gray-900 text-white w-12 h-12 flex items-center justify-center shadow-lg hover:bg-gray-800 transition-all duration-200 border border-gray-800"
        >
          {isOpen ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
        </button>
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 w-80 h-96 bg-white border border-gray-300 flex flex-col z-50 shadow-xl">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gray-900 flex items-center justify-center">
                  <MessageCircle className="w-3 h-3 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">AI Assistant</h3>
                  <p className="text-xs text-gray-600">Schedule helper</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 ${
                    message.type === 'user'
                      ? 'bg-gray-900 text-white ml-4'
                      : 'bg-gray-100 text-gray-900 mr-4'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-900 px-3 py-2 mr-4">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-gray-500 animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-gray-500 animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1.5 h-1.5 bg-gray-500 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Describe your event..."
                className="flex-1 px-3 py-2 border border-gray-300 focus:outline-none focus:border-gray-900 text-sm"
                disabled={isTyping}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isTyping}
                className="px-3 py-2 bg-gray-900 text-white hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-1"
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