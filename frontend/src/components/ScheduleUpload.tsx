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
    
    console.log(`🔍 Parsing day string: "${dayString}" -> "${dayStr}"`);
    
    // Handle common patterns first
    if (dayStr.includes('MWF') || dayStr.includes('M W F')) {
      console.log(`✅ Found MWF pattern -> [1, 3, 5]`);
      return [1, 3, 5]; // Monday, Wednesday, Friday
    }
    if (dayStr.includes('TTH') || dayStr.includes('T TH') || dayStr.includes('TU TH')) {
      console.log(`✅ Found TTH pattern -> [2, 4]`);
      return [2, 4]; // Tuesday, Thursday
    }
    if (dayStr.includes('MW') || dayStr.includes('M W')) {
      console.log(`✅ Found MW pattern -> [1, 3]`);
      return [1, 3]; // Monday, Wednesday
    }
    if (dayStr.includes('WF') || dayStr.includes('W F')) {
      console.log(`✅ Found WF pattern -> [3, 5]`);
      return [3, 5]; // Wednesday, Friday
    }
    
    // Check for "Monday Thursday" or "Monday, Thursday" patterns
    if (dayStr.includes('MONDAY') && dayStr.includes('THURSDAY')) {
      console.log(`✅ Found Monday Thursday pattern -> [1, 4]`);
      return [1, 4];
    }
    if (dayStr.includes('WEDNESDAY') && dayStr.includes('FRIDAY')) {
      console.log(`✅ Found Wednesday Friday pattern -> [3, 5]`);
      return [3, 5];
    }
    
    // Check individual days (exact matches for single day tutorials)
    console.log(`🔍 Checking individual days in: "${dayStr}"`);
    
    // Handle exact day names for tutorials
    if (dayStr === 'SUNDAY') {
      console.log(`✅ Found exact Sunday -> adding 0`);
      days.push(0);
    } else if (dayStr === 'MONDAY') {
      console.log(`✅ Found exact Monday -> adding 1`);
      days.push(1);
    } else if (dayStr === 'TUESDAY') {
      console.log(`✅ Found exact Tuesday -> adding 2`);
      days.push(2);
    } else if (dayStr === 'WEDNESDAY') {
      console.log(`✅ Found exact Wednesday -> adding 3`);
      days.push(3);
    } else if (dayStr === 'THURSDAY') {
      console.log(`✅ Found exact Thursday -> adding 4`);
      days.push(4);
    } else if (dayStr === 'FRIDAY') {
      console.log(`✅ Found exact Friday -> adding 5`);
      days.push(5);
    } else if (dayStr === 'SATURDAY') {
      console.log(`✅ Found exact Saturday -> adding 6`);
      days.push(6);
    } else {
      // Fall back to substring matching for multi-day patterns
      if (dayStr.includes('SUN') || dayStr.includes('SUNDAY')) {
        console.log(`✅ Found Sunday -> adding 0`);
        days.push(0);
      }
      if (dayStr.includes('MON') || dayStr.includes('MONDAY')) {
        console.log(`✅ Found Monday -> adding 1`);
        days.push(1);
      }
      if (dayStr.includes('TUE') || dayStr.includes('TUESDAY')) {
        console.log(`✅ Found Tuesday -> adding 2`);
        days.push(2);
      }
      if (dayStr.includes('WED') || dayStr.includes('WEDNESDAY')) {
        console.log(`✅ Found Wednesday -> adding 3`);
        days.push(3);
      }
      if (dayStr.includes('THU') || dayStr.includes('THURSDAY')) {
        console.log(`✅ Found Thursday -> adding 4`);
        days.push(4);
      }
      if (dayStr.includes('FRI') || dayStr.includes('FRIDAY')) {
        console.log(`✅ Found Friday -> adding 5`);
        days.push(5);
      }
      if (dayStr.includes('SAT') || dayStr.includes('SATURDAY')) {
        console.log(`✅ Found Saturday -> adding 6`);
        days.push(6);
      }
    }
    
    console.log(`🎯 Final parsed days: [${days.join(', ')}]`);
    
    // If no days found, default to Monday
    if (days.length === 0) {
      console.log(`⚠️ No days found, defaulting to Monday -> [1]`);
      return [1];
    }
    
    return days;
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
        console.log(`🤖 AI extracted ${response.events.length} events:`, response.events);
        setExtractedEvents(response.events);
        setUploadStatus('success');
        
        // Convert to Event format and create separate events for each day
        const events: Partial<Event>[] = [];
        
        let totalCreated = 0;
        response.events.forEach((event: ExtractedEvent, index: number) => {
          // Handle multiple days (e.g., "MWF", "Mon Wed Fri", "Tuesday/Thursday")
          console.log(`\n📚 Processing event #${index + 1}: "${event.title}"`);
          console.log(`   📅 Raw day string: "${event.day}"`);
          console.log(`   🕐 Time: "${event.time}"`);
          console.log(`   📍 Location: "${event.location || 'N/A'}"`);
          console.log(`   ⏱️ Duration: ${event.duration} min`);
          
          const days = parseDaysOfWeek(event.day);
          console.log(`   🎯 Will create ${days.length} events for days: [${days.map(d => getDayName(d)).join(', ')}]`);
          
          days.forEach((dayOfWeek: number, dayIndex: number) => {
            totalCreated++;
            console.log(`     ➕ Creating event #${totalCreated}: ${event.title} (${getDayName(dayOfWeek)}) at ${event.time}`);
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
        
        console.log(`\n🎉 SUMMARY: Created ${totalCreated} events from ${response.events.length} AI-extracted events`);
        
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
              text: `Look at this university schedule image very carefully. 

FIRST: Tell me what you see in the header row - what are the day names from left to right?

SECOND: For each colored course block, tell me:
- What course it is (e.g. "ECON 102", "CS 245", etc.)
- What time it shows
- Which day column(s) it appears under (be very precise - look at the headers above each block)

THIRD: Based on which day columns each course appears under:
- If a course appears under the "Tuesday" column AND "Thursday" column → day: "TTH" 
- If a course appears under "Monday" AND "Wednesday" AND "Friday" columns → day: "MWF"
- If a course appears under only one column → use that day name (e.g. "Wednesday")

Be extremely careful to read the day headers correctly. Look at EACH course block and identify which specific day column headers it sits under.

Return JSON format:
{
  "events": [
    {
      "title": "Course Name - Section", 
      "time": "Start time from block",
      "day": "Which day columns the block spans",
      "location": "Room from block if visible",
      "duration": "Minutes between start and end time",
      "type": "mandatory",
      "priority": 1
    }
  ]
}

Be methodical: examine each colored block one by one, see which day column(s) it occupies, and extract that information accurately.`
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-indigo-600 rounded-lg shadow-sm">
          <Image className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Schedule Import</h2>
          <p className="text-sm text-gray-600">Upload class schedule image for AI parsing</p>
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
              <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors font-medium shadow-sm">
                <Upload className="w-4 h-4" />
                Select Schedule Image
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">Processing Image...</h3>
          <p className="text-sm text-gray-600">Extracting schedule information</p>
        </div>
      )}

      {uploadStatus === 'success' && extractedEvents.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600 mb-4">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">{extractedEvents.length} classes imported successfully</span>
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
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
            >
              Import Another Schedule
            </button>
          </div>
        </div>
      )}

      {uploadStatus === 'error' && (
        <div className="text-center py-6">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Import Failed</h3>
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