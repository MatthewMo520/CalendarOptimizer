import React, { useState, useCallback } from 'react';
import { Upload, Image, AlertCircle, CheckCircle2, Loader } from 'lucide-react';
import { Event } from '../types/Event';

interface ScheduleUploadProps {
  onEventsExtracted: (events: Partial<Event>[]) => void;
}

interface ExtractedEvent {
  title: string;
  time: string;
  day: string;
  location?: string;
  duration: number;
  type: 'fixed' | 'flexible' | 'mandatory';
  priority: 1 | 2 | 3;
}

const ScheduleUpload: React.FC<ScheduleUploadProps> = ({ onEventsExtracted }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [extractedEvents, setExtractedEvents] = useState<ExtractedEvent[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const parseDaysOfWeek = (dayString: string): number[] => {
    const days: number[] = [];
    const dayStr = dayString.toUpperCase();
    
    // Handle common patterns
    if (dayStr.includes('MWF') || dayStr.includes('M W F')) {
      return [1, 3, 5]; // Monday, Wednesday, Friday
    }
    if (dayStr.includes('TTH') || dayStr.includes('T TH') || dayStr.includes('TU TH')) {
      return [2, 4]; // Tuesday, Thursday
    }
    if (dayStr.includes('MW') || dayStr.includes('M W')) {
      return [1, 3]; // Monday, Wednesday
    }
    if (dayStr.includes('WF') || dayStr.includes('W F')) {
      return [3, 5]; // Wednesday, Friday
    }
    
    // Check individual days
    if (dayStr.includes('SUN') || dayStr.includes('SUNDAY')) days.push(0);
    if (dayStr.includes('MON') || dayStr.includes('MONDAY') || dayStr.includes(' M ') || dayStr.startsWith('M ') || dayStr.endsWith(' M')) days.push(1);
    if (dayStr.includes('TUE') || dayStr.includes('TUESDAY') || dayStr.includes(' T ') || dayStr.startsWith('T ') || dayStr.endsWith(' T')) days.push(2);
    if (dayStr.includes('WED') || dayStr.includes('WEDNESDAY') || dayStr.includes(' W ') || dayStr.startsWith('W ') || dayStr.endsWith(' W')) days.push(3);
    if (dayStr.includes('THU') || dayStr.includes('THURSDAY') || dayStr.includes('TH')) days.push(4);
    if (dayStr.includes('FRI') || dayStr.includes('FRIDAY') || dayStr.includes(' F ') || dayStr.startsWith('F ') || dayStr.endsWith(' F')) days.push(5);
    if (dayStr.includes('SAT') || dayStr.includes('SATURDAY')) days.push(6);
    
    // If no days found, default to Monday
    return days.length > 0 ? days : [1];
  };

  const getDayName = (dayOfWeek: number): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek] || 'Monday';
  };

  const processImage = useCallback(async (file: File) => {
    try {
      setUploadStatus('processing');
      setErrorMessage('');

      // Convert image to base64 for Gemini Vision API
      const base64Image = await fileToBase64(file);
      
      // Use Gemini Vision API to extract schedule data
      const response = await extractScheduleFromImage(base64Image);
      
      if (response.events && response.events.length > 0) {
        setExtractedEvents(response.events);
        setUploadStatus('success');
        
        // Convert to Event format and create separate events for each day
        const events: Partial<Event>[] = [];
        
        response.events.forEach((event: ExtractedEvent, index: number) => {
          // Handle multiple days (e.g., "MWF", "Mon Wed Fri", "Tuesday/Thursday")
          console.log(`Parsing day string: "${event.day}" for event: ${event.title}`);
          const days = parseDaysOfWeek(event.day);
          console.log(`Parsed days:`, days);
          
          days.forEach((dayOfWeek: number, dayIndex: number) => {
            console.log(`Creating event: ${event.title} for day ${dayOfWeek} (${getDayName(dayOfWeek)}) at ${event.time}`);
            events.push({
              id: `schedule-${Date.now()}-${index}-${dayIndex}`,
              title: `${event.title} (${getDayName(dayOfWeek)})`,
              duration: event.duration,
              priority: 1, // Force all classes to be highest priority
              type: 'mandatory', // Force all classes to be mandatory (cannot be moved)
              location: event.location,
              description: `Class schedule: ${getDayName(dayOfWeek)} at ${event.time}`,
              // Store both time and day for proper scheduling
              fixedTime: event.time,
              dayOfWeek: dayOfWeek, // 0=Sunday, 1=Monday, etc.
              isScheduled: false,
            });
          });
        });
        
        onEventsExtracted(events);
      } else {
        throw new Error('No schedule events found in the image');
      }
    } catch (error) {
      console.error('Schedule processing error:', error);
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to process schedule image');
    }
  }, [onEventsExtracted]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = error => reject(error);
    });
  };

  const extractScheduleFromImage = async (base64Image: string) => {
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY || localStorage.getItem('gemini_api_key');
    
    if (!apiKey) {
      throw new Error('Gemini API key not found');
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `Analyze this schedule image and extract all class/event information. Return ONLY a JSON object in this exact format:
{
  "events": [
    {
      "title": "Course/Event Name",
      "time": "HH:MM AM/PM",
      "day": "Day of week",
      "location": "Room/Location (if available)",
      "duration": 60,
      "type": "mandatory",
      "priority": 1
    }
  ]
}

Guidelines:
- Extract course names, times, days, and locations
- Duration should be estimated (typical classes are 50-90 minutes)  
- Type should ALWAYS be "mandatory" for all classes (they cannot be moved)
- Priority should ALWAYS be 1 (highest priority) for all classes
- Parse all visible schedule entries
- If time ranges are shown (like "9:00-10:30"), calculate duration in minutes
- Classes are fixed-time events that cannot be rescheduled
- Return valid JSON only, no additional text`
            },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Image
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2000,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error('No response from Gemini API');
    }

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }
      
      return JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Raw response:', text);
      throw new Error('Failed to parse schedule data from image');
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      setSelectedImage(URL.createObjectURL(imageFile));
      processImage(imageFile);
    }
  }, [processImage]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(URL.createObjectURL(file));
      processImage(file);
    }
  };

  const resetUpload = () => {
    setUploadStatus('idle');
    setSelectedImage(null);
    setExtractedEvents([]);
    setErrorMessage('');
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg">
          <Image className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Upload Schedule</h2>
          <p className="text-sm text-gray-500">Import your class schedule from an image</p>
        </div>
      </div>

      {uploadStatus === 'idle' && (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
            isDragOver 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-4">
            <Upload className={`w-12 h-12 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
            <div>
              <p className="text-lg font-medium text-gray-900 mb-1">
                Drop your schedule image here
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Supports JPG, PNG, PDF screenshots of schedules
              </p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                Choose File
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileSelect}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {uploadStatus === 'processing' && (
        <div className="text-center py-8">
          <Loader className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Processing Schedule...</h3>
          <p className="text-sm text-gray-500">Using AI to extract your class information</p>
        </div>
      )}

      {uploadStatus === 'success' && extractedEvents.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600 mb-4">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">Successfully extracted {extractedEvents.length} events!</span>
          </div>

          {selectedImage && (
            <div className="mb-4">
              <img 
                src={selectedImage} 
                alt="Uploaded schedule" 
                className="max-w-full h-48 object-contain mx-auto rounded-lg border"
              />
            </div>
          )}

          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Extracted Events:</h4>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {extractedEvents.map((event, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{event.title}</div>
                    <div className="text-sm text-gray-600">
                      {event.day} at {event.time} • {event.duration} min
                      {event.location && ` • ${event.location}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">
                      Priority 1
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={resetUpload}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Upload Another
            </button>
          </div>
        </div>
      )}

      {uploadStatus === 'error' && (
        <div className="text-center py-6">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Processing Failed</h3>
          <p className="text-sm text-red-600 mb-4">{errorMessage}</p>
          <button
            onClick={resetUpload}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default ScheduleUpload;