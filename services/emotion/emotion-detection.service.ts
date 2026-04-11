import { GoogleGenerativeAI } from '@google/generative-ai';

// Emotion detection types
export interface EmotionData {
  emotion: EmotionLabel;
  confidence: number;
  timestamp: number;
  secondsFromStart: number;
  duration?: number;
  intensity: 'low' | 'medium' | 'high';
  additionalMetrics?: {
    stress_level?: number;
    energy_level?: number;
    speaking_pace?: 'slow' | 'normal' | 'fast';
    voice_stability?: number;
  };
}

export type EmotionLabel = 
  | 'happy' 
  | 'neutral' 
  | 'nervous' 
  | 'confident' 
  | 'stressed' 
  | 'excited' 
  | 'disappointed' 
  | 'frustrated' 
  | 'calm' 
  | 'uncertain';

export interface EmotionAnalysisResult {
  emotions: EmotionData[];
  dominantEmotion: EmotionLabel;
  emotionalTrend: 'improving' | 'declining' | 'stable';
  summary: {
    averageConfidence: number;
    mostFrequentEmotion: EmotionLabel;
    emotionalStability: number;
    stressIndicators: string[];
  };
}

interface AudioFeatures {
  pitch: number[];
  energy: number[];
  spectralCentroid: number[];
  zeroCrossingRate: number[];
  mfcc: number[][];
}

class EmotionDetectionService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private requestCount = 0;
  private readonly RATE_LIMIT_DELAY = 4500; // 4.5s delay to stay under 15 RPM free tier limit safely
  private readonly MAX_RETRIES = 3;
  private readonly emotionCache = new Map<string, EmotionData>();

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY;
    const fallbackOnly = process.env.EMOTION_DETECTION_FALLBACK_ONLY === 'true';
    
    if (!apiKey || fallbackOnly) {
      console.warn('Google AI API key not found or fallback mode enabled. Emotion detection will use fallback analysis.');
    }
    this.genAI = new GoogleGenerativeAI(apiKey || '');
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3, // Lower temperature for more consistent emotion analysis
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 1024,
      }
    });
  }

  /**
   * Rate-limited request wrapper for Gemini API
   */
  private async makeRateLimitedRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  /**
   * Process request queue with rate limiting
   */
  private async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      // Wait if we need to respect rate limit
      if (timeSinceLastRequest < this.RATE_LIMIT_DELAY) {
        const waitTime = this.RATE_LIMIT_DELAY - timeSinceLastRequest;
        console.log(`Rate limiting: waiting ${waitTime}ms before next request`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      const request = this.requestQueue.shift();
      if (request) {
        try {
          await request();
          this.lastRequestTime = Date.now();
          this.requestCount++;
        } catch (error) {
          console.error('Queue request failed:', error);
        }
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Retry logic with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = this.MAX_RETRIES,
    baseDelay: number = 2000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        if (attempt === maxRetries) {
          throw error;
        }

        // Check if it's a rate limit error
        if (error.message?.includes('429') || error.message?.includes('quota')) {
          const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
          console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error; // Don't retry non-rate-limit errors
        }
      }
    }
    throw new Error('Max retries exceeded');
  }

  /**
   * Analyze text transcript for emotional content using Gemini AI with rate limiting
   */
  async analyzeTextEmotion(
    text: string, 
    timestamp: number, 
    speakingDuration: number = 0
  ): Promise<EmotionData> {
    // Check if fallback mode is enabled
    const fallbackOnly = process.env.EMOTION_DETECTION_FALLBACK_ONLY === 'true';
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY;
    
    if (fallbackOnly || !apiKey) {
      console.log('Using fallback emotion analysis (API disabled or unavailable)');
      return this.fallbackTextAnalysis(text, timestamp, speakingDuration);
    }

    // Create cache key
    const cacheKey = `${text.trim().toLowerCase()}_${speakingDuration}`;
    
    // Check cache first
    if (this.emotionCache.has(cacheKey)) {
      const cachedResult = this.emotionCache.get(cacheKey)!;
      return {
        ...cachedResult,
        timestamp,
        secondsFromStart: timestamp / 1000
      };
    }

    // Skip very short texts to reduce API calls
    if (text.trim().length < 10) {
      return this.fallbackTextAnalysis(text, timestamp, speakingDuration);
    }

    try {
      const result = await this.makeRateLimitedRequest(async () => {
        return await this.retryWithBackoff(async () => {
          const prompt = `
            You are an expert emotion analyst for job interviews. Analyze the emotional tone, confidence level, and stress indicators in this candidate's response.

            Text: "${text}"

            Provide your analysis as a JSON object with this exact structure:
            {
              "emotion": "happy|neutral|nervous|confident|stressed|excited|disappointed|frustrated|calm|uncertain",
              "confidence": 0.85,
              "intensity": "low|medium|high",
              "stress_level": 0.3,
              "energy_level": 0.7,
              "speaking_pace": "slow|normal|fast",
              "voice_stability": 0.8,
              "reasoning": "Brief explanation of the analysis"
            }

            Analysis criteria:
            - EMOTION: Primary emotional state based on word choice, tone, and content
            - CONFIDENCE: 0.0-1.0 based on certainty of language and assertiveness
            - INTENSITY: How strongly the emotion is expressed
            - STRESS_LEVEL: 0.0-1.0 based on hesitation, filler words, uncertainty markers
            - ENERGY_LEVEL: 0.0-1.0 based on enthusiasm and engagement
            - SPEAKING_PACE: Inferred from text structure and verbosity
            - VOICE_STABILITY: 0.0-1.0 based on consistency and composure
            - REASONING: 1-2 sentence explanation of your assessment

            Look for:
            - Confidence markers: "definitely", "I'm certain", "I know", "absolutely"
            - Nervous indicators: "um", "uh", "I think maybe", "not really sure"
            - Stress patterns: repetition, incomplete thoughts, excessive qualifiers
            - Professional tone: structured responses, technical vocabulary
            - Enthusiasm: positive language, detailed examples, proactive statements

            Respond only with the JSON object, no additional text.
          `;

          const result = await this.model.generateContent(prompt);
          return result.response.text();
        });
      });
      
      // Extract JSON from response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      let analysis: any = {};
      
      if (!jsonMatch) {
        console.warn('Invalid response format from Gemini for emotion analysis. Raw result:', result);
        // Fallback to neutral
        analysis = {
          emotion: 'neutral',
          confidence: 0.5,
          intensity: 'medium',
          stress_level: 0.5,
          energy_level: 0.5
        };
      } else {
        try {
          analysis = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('Failed to parse emotion analysis JSON:', e);
          analysis = {
            emotion: 'neutral',
            confidence: 0.5,
            intensity: 'medium',
            stress_level: 0.5,
            energy_level: 0.5
          };
        }
      }
      
      const emotionData: EmotionData = {
        emotion: analysis.emotion as EmotionLabel,
        confidence: Math.min(Math.max(analysis.confidence || 0.5, 0), 1),
        timestamp,
        secondsFromStart: timestamp / 1000,
        duration: speakingDuration,
        intensity: analysis.intensity || 'medium',
        additionalMetrics: {
          stress_level: analysis.stress_level || 0.5,
          energy_level: analysis.energy_level || 0.5,
          speaking_pace: analysis.speaking_pace || 'normal',
          voice_stability: analysis.voice_stability || 0.5,
        }
      };

      // Cache the result (without timestamp for reusability)
      const cacheableData: Partial<EmotionData> = {
        emotion: emotionData.emotion,
        confidence: emotionData.confidence,
        duration: emotionData.duration,
        intensity: emotionData.intensity,
        additionalMetrics: emotionData.additionalMetrics
      };
      this.emotionCache.set(cacheKey, cacheableData as EmotionData);

      // Limit cache size
      if (this.emotionCache.size > 100) {
        const firstKey = this.emotionCache.keys().next().value;
        if (firstKey) {
          this.emotionCache.delete(firstKey);
        }
      }

      return emotionData;

    } catch (error: any) {
      console.error('Error analyzing text emotion:', error);
      
      // Always fallback to rule-based analysis on any error
      return this.fallbackTextAnalysis(text, timestamp, speakingDuration);
    }
  }

  /**
   * Fallback rule-based emotion detection for text
   */
  private fallbackTextAnalysis(
    text: string, 
    timestamp: number, 
    speakingDuration: number
  ): EmotionData {
    const lowerText = text.toLowerCase();
    
    // Define emotion keywords and patterns
    const emotionPatterns = {
      confident: ['sure', 'definitely', 'absolutely', 'i know', 'certain', 'experience'],
      nervous: ['um', 'uh', 'i think', 'maybe', 'not sure', 'i guess'],
      excited: ['great', 'amazing', 'love', 'excited', 'fantastic', 'wonderful'],
      stressed: ['difficult', 'hard', 'struggle', 'challenging', 'overwhelming'],
      frustrated: ['but', 'however', 'unfortunately', 'problem', 'issue'],
      calm: ['okay', 'fine', 'alright', 'steady', 'stable'],
      happy: ['good', 'well', 'positive', 'pleased', 'satisfied'],
      disappointed: ['not good', 'unfortunately', 'sadly', 'failed', 'disappointed']
    };

    let maxScore = 0;
    let detectedEmotion: EmotionLabel = 'neutral';
    
    // Calculate scores for each emotion
    Object.entries(emotionPatterns).forEach(([emotion, keywords]) => {
      const score = keywords.reduce((acc, keyword) => {
        const occurrences = (lowerText.match(new RegExp(keyword, 'g')) || []).length;
        return acc + occurrences;
      }, 0);
      
      if (score > maxScore) {
        maxScore = score;
        detectedEmotion = emotion as EmotionLabel;
      }
    });

    // Calculate confidence based on text length and keyword density
    const wordCount = text.split(' ').length;
    const confidence = Math.min(0.3 + (maxScore / wordCount) * 2, 0.85);

    // Determine intensity based on text features
    const hasCapitals = /[A-Z]{2,}/.test(text);
    const hasExclamation = text.includes('!');
    const hasQuestion = text.includes('?');
    
    let intensity: 'low' | 'medium' | 'high' = 'medium';
    if (hasCapitals || hasExclamation || maxScore > 2) {
      intensity = 'high';
    } else if (maxScore === 0 || text.length < 20) {
      intensity = 'low';
    }

    return {
      emotion: detectedEmotion,
      confidence,
      timestamp,
      secondsFromStart: timestamp / 1000,
      duration: speakingDuration,
      intensity,
      additionalMetrics: {
        stress_level: ['nervous', 'stressed'].includes(detectedEmotion) ? 0.7 : 0.3,
        energy_level: ['excited', 'confident'].includes(detectedEmotion) ? 0.8 : 0.5,
        speaking_pace: wordCount > 50 ? 'fast' : wordCount < 20 ? 'slow' : 'normal',
        voice_stability: confidence
      }
    };
  }

  /**
   * Process a complete interview transcript and generate emotion timeline
   * Uses batch processing to minimize API calls
   */
  async analyzeCompleteTranscript(messages: any[]): Promise<EmotionAnalysisResult> {
    const emotions: EmotionData[] = [];
    
    // Filter for user messages only (candidate responses)
    const userMessages = messages.filter(msg => 
      msg.role === 'user' && 
      msg.message && 
      msg.message.trim().length > 0
    );

    if (userMessages.length === 0) {
      return {
        emotions: [],
        dominantEmotion: 'neutral',
        emotionalTrend: 'stable',
        summary: {
          averageConfidence: 0,
          mostFrequentEmotion: 'neutral',
          emotionalStability: 0,
          stressIndicators: []
        }
      };
    }

    try {
      // BATCH PROCESSING: Group messages to single API call
      const prompt = `
        You are an expert emotion analyst for job interviews. Analyze the emotional tone, confidence level, and stress indicators for the following candidate responses.
        
        INPUT MESSAGES:
        ${userMessages.map((msg, i) => `Response ${i}: "${msg.message}"`).join('\n\n')}

        Provide your analysis as a strictly valid JSON object containing an array "results" where each item corresponds to the input messages in order.
        
        JSON Structure:
        {
          "results": [
            {
              "emotion": "happy|neutral|nervous|confident|stressed|excited|disappointed|frustrated|calm|uncertain",
              "confidence": 0.85, (0.0-1.0)
              "intensity": "low|medium|high",
              "stress_level": 0.3, (0.0-1.0)
              "energy_level": 0.7, (0.0-1.0)
              "speaking_pace": "slow|normal|fast"
            }
          ]
        }
      `;

      const result = await this.makeRateLimitedRequest(async () => {
        return await this.retryWithBackoff(async () => {
          const content = await this.model.generateContent(prompt);
          return content.response.text();
        });
      });

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      let batchResults: any[] = [];
      
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.results && Array.isArray(parsed.results)) {
            batchResults = parsed.results;
          }
        } catch (e) {
          console.error("Failed to parse batch emotion results", e);
        }
      }

      // Map results back to messages
      for (let i = 0; i < userMessages.length; i++) {
        const message = userMessages[i];
        const analysis = batchResults[i] || {
           // Fallback if AI missed one or failed
           emotion: 'neutral',
           confidence: 0.5,
           intensity: 'medium',
           stress_level: 0.5,
           energy_level: 0.5
        };

        emotions.push({
          emotion: analysis.emotion as EmotionLabel,
          confidence: Math.min(Math.max(analysis.confidence || 0.5, 0), 1),
          timestamp: message.time || Date.now(),
          secondsFromStart: (message.time || Date.now()) / 1000,
          duration: message.duration || 0,
          intensity: analysis.intensity || 'medium',
          additionalMetrics: {
            stress_level: analysis.stress_level || 0.5,
            energy_level: analysis.energy_level || 0.5,
            speaking_pace: analysis.speaking_pace || 'normal',
            voice_stability: analysis.confidence || 0.5
          }
        });
      }

    } catch (error) {
       console.error("Batch emotion analysis failed, falling back to local analysis", error);
       // Fallback: loop and use local analysis
       for (const message of userMessages) {
          emotions.push(this.fallbackTextAnalysis(
            message.message, 
            message.time || Date.now(), 
            message.duration || 0
          ));
       }
    }

    // Calculate summary metrics
    const summary = this.calculateEmotionSummary(emotions);
    
    return {
      emotions,
      dominantEmotion: summary.mostFrequentEmotion,
      emotionalTrend: this.calculateEmotionalTrend(emotions),
      summary
    };
  }

  /*
  // ORIGINAL METHOD COMMENTED OUT
  async analyzeCompleteTranscript_OLD(messages: any[]): Promise<EmotionAnalysisResult> {
  */


  /**
   * Real-time emotion detection for streaming transcript
   */
  async processStreamingMessage(
    message: string,
    timestamp: number,
    isPartial: boolean = false
  ): Promise<EmotionData | null> {
    // Only process final transcripts to avoid too many API calls
    if (isPartial || message.trim().length < 10) {
      return null;
    }

    return await this.analyzeTextEmotion(message, timestamp);
  }

  /**
   * Calculate emotion summary statistics
   */
  private calculateEmotionSummary(emotions: EmotionData[]) {
    if (emotions.length === 0) {
      return {
        averageConfidence: 0,
        mostFrequentEmotion: 'neutral' as EmotionLabel,
        emotionalStability: 0,
        stressIndicators: []
      };
    }

    // Calculate average confidence
    const averageConfidence = emotions.reduce((sum, e) => sum + e.confidence, 0) / emotions.length;

    // Find most frequent emotion
    const emotionCounts = emotions.reduce((acc, e) => {
      acc[e.emotion] = (acc[e.emotion] || 0) + 1;
      return acc;
    }, {} as Record<EmotionLabel, number>);

    const mostFrequentEmotion = Object.entries(emotionCounts)
      .sort(([,a], [,b]) => b - a)[0][0] as EmotionLabel;

    // Calculate emotional stability (less variation = more stable)
    const uniqueEmotions = new Set(emotions.map(e => e.emotion)).size;
    const emotionalStability = Math.max(0, 1 - (uniqueEmotions / emotions.length));

    // Identify stress indicators
    const stressIndicators: string[] = [];
    const stressedCount = emotions.filter(e => e.emotion === 'stressed' || e.emotion === 'nervous').length;
    const averageStress = emotions.reduce((sum, e) => sum + (e.additionalMetrics?.stress_level || 0), 0) / emotions.length;

    if (stressedCount > emotions.length * 0.3) {
      stressIndicators.push('High frequency of stressed/nervous responses');
    }
    if (averageStress > 0.6) {
      stressIndicators.push('Elevated stress levels detected');
    }
    if (emotionalStability < 0.5) {
      stressIndicators.push('High emotional volatility');
    }

    return {
      averageConfidence,
      mostFrequentEmotion,
      emotionalStability,
      stressIndicators
    };
  }

  /**
   * Calculate emotional trend over time
   */
  private calculateEmotionalTrend(emotions: EmotionData[]): 'improving' | 'declining' | 'stable' {
    if (emotions.length < 3) return 'stable';

    const positiveEmotions = ['happy', 'confident', 'excited', 'calm'];
    const negativeEmotions = ['nervous', 'stressed', 'frustrated', 'disappointed', 'uncertain'];

    const firstHalf = emotions.slice(0, Math.floor(emotions.length / 2));
    const secondHalf = emotions.slice(Math.floor(emotions.length / 2));

    const firstHalfPositive = firstHalf.filter(e => positiveEmotions.includes(e.emotion)).length / firstHalf.length;
    const secondHalfPositive = secondHalf.filter(e => positiveEmotions.includes(e.emotion)).length / secondHalf.length;

    const improvement = secondHalfPositive - firstHalfPositive;

    if (improvement > 0.1) return 'improving';
    if (improvement < -0.1) return 'declining';
    return 'stable';
  }

  /**
   * Get emotion color for visualization
   */
  getEmotionColor(emotion: EmotionLabel): string {
    const colorMap: Record<EmotionLabel, string> = {
      happy: '#10B981',      // green
      confident: '#3B82F6',  // blue
      excited: '#F59E0B',    // amber
      calm: '#6366F1',       // indigo
      neutral: '#6B7280',    // gray
      nervous: '#EF4444',    // red
      stressed: '#DC2626',   // red-600
      frustrated: '#B91C1C', // red-700
      disappointed: '#7C2D12', // orange-900
      uncertain: '#D97706'   // orange-600
    };
    return colorMap[emotion] || '#6B7280';
  }


}

export const emotionDetectionService = new EmotionDetectionService();
