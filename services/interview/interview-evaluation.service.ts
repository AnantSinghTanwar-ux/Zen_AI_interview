import { GoogleGenerativeAI } from '@google/generative-ai';

// Interview evaluation types
export interface InterviewEvaluation {
  overallRating: number; // 1-10
  aspects: {
    technicalKnowledge: AspectRating;
    problemSolving: AspectRating;
    communication: AspectRating;
    criticalThinking: AspectRating;
    codeQuality: AspectRating;
    systemDesign: AspectRating;
    behavioralFit: AspectRating;
  };
  strengths: string[];
  areasForImprovement: string[];
  recommendation: 'Strong Hire' | 'Hire' | 'No Hire' | 'Strong No Hire';
  detailedFeedback: string;
  confidenceLevel: number; // 1-10
}

export interface AspectRating {
  score: number; // 1-10
  feedback: string;
  evidence: string[];
}

class InterviewEvaluationService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private initialized = false;

  constructor() {
    // Don't initialize immediately - do it lazily when needed
  }

  private initialize() {
    if (this.initialized) return;
    
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      console.warn('Google AI API key not found. Interview evaluation will not be available.');
      this.genAI = null;
      this.model = null;
    } else {
      try {
        this.genAI = new GoogleGenerativeAI(apiKey);
        // Use gemini-2.5-flash
        this.model = this.genAI.getGenerativeModel({ 
          model: 'gemini-2.5-flash',
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.1,
          },
        });
        console.log('Interview evaluation service initialized successfully');
      } catch (error) {
        console.error('Failed to initialize Google AI service:', error);
        this.genAI = null;
        this.model = null;
      }
    }
    
    this.initialized = true;
  }

  /**
   * Check if the service is available
   */
  isAvailable(): boolean {
    this.initialize();
    return this.model !== null;
  }

  /**
   * Evaluate interview performance based on conversation transcript
   */
  async evaluateInterview(messages: any[], callDetails: any): Promise<InterviewEvaluation> {
    // Initialize and check if service is available
    this.initialize();
    
    if (!this.isAvailable()) {
      throw new Error('Interview evaluation service is not available. Please configure Google AI API key.');
    }

    try {
      // Extract conversation transcript
      const transcript = this.extractConversationTranscript(messages);
      
      if (!transcript || transcript.trim().length === 0) {
        throw new Error('No conversation content found to evaluate');
      }
      
      // Create comprehensive evaluation prompt
      const prompt = this.createEvaluationPrompt(transcript, callDetails);
      
      // Get evaluation from Gemini
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      
      // Extract JSON object directly from response (ignoring markdown fences)
      const firstBrace = response.indexOf('{');
      const lastBrace = response.lastIndexOf('}');
      
      if (firstBrace === -1 || lastBrace === -1) {
        console.error('Gemini Raw Response (No JSON found):', response);
        // Fallback: If no JSON found, throw specific error with preview of response
        const preview = response.substring(0, 200);
        throw new Error(`Invalid response format from Gemini AI: No JSON object found. Response preview: ${preview}...`);
      }
      
      let jsonString = response.substring(firstBrace, lastBrace + 1);
      
      // Attempt to clean common JSON errors
      // 1. Remove trailing commas before closing braces/brackets
      jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');

      let evaluation: any;
      try {
        evaluation = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('Raw Response:', response);
        console.error('Extracted JSON String:', jsonString);
        throw new Error(`Failed to parse evaluation JSON. Error: ${(parseError as Error).message}. Snippet: ${jsonString.substring(0, 150)}...`);
      }
      
      // Validate and sanitize the evaluation
      return this.validateEvaluation(evaluation);

    } catch (error) {
      console.error('Error evaluating interview:', error);
      
      if (error instanceof Error) {
        // Handle specific Google AI errors
        if (error.message.includes('429') || error.message.includes('quota')) {
          throw new Error('API quota exceeded. Please try again later or upgrade your Google AI plan.');
        }
        if (error.message.includes('403') || error.message.includes('API key')) {
          throw new Error('Invalid API key. Please check your Google AI API key configuration.');
        }
        throw error;
      } else {
        throw new Error('Failed to evaluate interview performance');
      }
    }
  }

  /**
   * Extract clean conversation transcript from messages
   */
  private extractConversationTranscript(messages: any[]): string {
    return messages
      .filter(msg => msg.role !== 'system' && msg.message?.trim())
      .map(msg => {
        const role = msg.role === 'user' ? 'Candidate' : 'Interviewer';
        const timestamp = msg.secondsFromStart ? `[${Math.round(msg.secondsFromStart)}s]` : '';
        return `${timestamp} ${role}: ${msg.message.trim()}`;
      })
      .join('\n\n');
  }

  /**
   * Create comprehensive evaluation prompt for Gemini
   */
  private createEvaluationPrompt(transcript: string, callDetails: any): string {
    return `
You are an expert technical interviewer evaluating a candidate's performance. Analyze this interview transcript and provide a comprehensive evaluation.

INTERVIEW DETAILS:
- Duration: ${callDetails.duration || 'Unknown'}
- Status: ${callDetails.status}
- Message Count: ${callDetails.messageCount || 0}

TRANSCRIPT:
${transcript}

Please evaluate the candidate across these aspects and provide a JSON response with the following structure:

{
  "overallRating": 7.5,
  "aspects": {
    "technicalKnowledge": {
      "score": 8,
      "feedback": "Strong understanding of core concepts",
      "evidence": ["Correctly explained algorithms", "Demonstrated knowledge of data structures"]
    },
    "problemSolving": {
      "score": 7,
      "feedback": "Good analytical approach",
      "evidence": ["Broke down complex problems", "Asked clarifying questions"]
    },
    "communication": {
      "score": 8,
      "feedback": "Clear and articulate responses",
      "evidence": ["Explained thought process well", "Asked relevant questions"]
    },
    "criticalThinking": {
      "score": 6,
      "feedback": "Showed some analytical skills",
      "evidence": ["Considered edge cases", "Evaluated trade-offs"]
    },
    "codeQuality": {
      "score": 7,
      "feedback": "Well-structured solutions",
      "evidence": ["Clean code structure", "Good variable naming"]
    },
    "systemDesign": {
      "score": 6,
      "feedback": "Basic understanding of system architecture",
      "evidence": ["Discussed scalability", "Mentioned key components"]
    },
    "behavioralFit": {
      "score": 8,
      "feedback": "Professional and collaborative attitude",
      "evidence": ["Positive attitude", "Good team collaboration mindset"]
    }
  },
  "strengths": [
    "Strong technical foundation",
    "Excellent communication skills",
    "Good problem-solving approach"
  ],
  "areasForImprovement": [
    "Could improve system design knowledge",
    "More practice with complex algorithms needed"
  ],
  "recommendation": "Hire",
  "detailedFeedback": "The candidate demonstrated solid technical skills and excellent communication. They showed a methodical approach to problem-solving and were able to explain their thought process clearly. While there's room for improvement in system design, their overall performance indicates they would be a valuable addition to the team.",
  "confidenceLevel": 8
}

EVALUATION CRITERIA:
- Technical Knowledge (1-10): Understanding of programming concepts, algorithms, data structures
- Problem Solving (1-10): Ability to break down problems, find solutions, handle edge cases
- Communication (1-10): Clarity of explanation, asking good questions, articulating thoughts
- Critical Thinking (1-10): Analytical skills, considering trade-offs, evaluating options
- Code Quality (1-10): Clean code, best practices, maintainability
- System Design (1-10): Architecture understanding, scalability, system thinking
- Behavioral Fit (1-10): Attitude, collaboration, cultural fit

RECOMMENDATIONS:
- "Strong Hire": Exceptional candidate (Overall 8.5-10)
- "Hire": Good candidate (Overall 6.5-8.4)
- "No Hire": Below expectations (Overall 4-6.4)
- "Strong No Hire": Poor performance (Overall 1-3.9)

Analyze the transcript thoroughly and provide specific evidence for each rating. Be objective and constructive in your feedback. Keep the "detailedFeedback" section concise (under 200 words) to ensure valid JSON output.

Return ONLY the JSON object, no additional text. Ensure the JSON is valid standard JSON (no trailing commas, keys in double quotes).
    `;
  }

  /**
   * Validate and sanitize evaluation response
   */
  private validateEvaluation(evaluation: any): InterviewEvaluation {
    // Ensure all required fields exist and are within valid ranges
    const sanitized: InterviewEvaluation = {
      overallRating: Math.max(1, Math.min(10, evaluation.overallRating || 5)),
      aspects: {
        technicalKnowledge: this.validateAspect(evaluation.aspects?.technicalKnowledge),
        problemSolving: this.validateAspect(evaluation.aspects?.problemSolving),
        communication: this.validateAspect(evaluation.aspects?.communication),
        criticalThinking: this.validateAspect(evaluation.aspects?.criticalThinking),
        codeQuality: this.validateAspect(evaluation.aspects?.codeQuality),
        systemDesign: this.validateAspect(evaluation.aspects?.systemDesign),
        behavioralFit: this.validateAspect(evaluation.aspects?.behavioralFit),
      },
      strengths: Array.isArray(evaluation.strengths) ? evaluation.strengths.slice(0, 5) : [],
      areasForImprovement: Array.isArray(evaluation.areasForImprovement) ? evaluation.areasForImprovement.slice(0, 5) : [],
      recommendation: this.validateRecommendation(evaluation.recommendation),
      detailedFeedback: evaluation.detailedFeedback || 'No detailed feedback provided.',
      confidenceLevel: Math.max(1, Math.min(10, evaluation.confidenceLevel || 5))
    };

    return sanitized;
  }

  /**
   * Validate individual aspect rating
   */
  private validateAspect(aspect: any): AspectRating {
    return {
      score: Math.max(1, Math.min(10, aspect?.score || 5)),
      feedback: aspect?.feedback || 'No feedback provided.',
      evidence: Array.isArray(aspect?.evidence) ? aspect.evidence.slice(0, 3) : []
    };
  }

  /**
   * Validate recommendation
   */
  private validateRecommendation(recommendation: string): InterviewEvaluation['recommendation'] {
    const validRecommendations: InterviewEvaluation['recommendation'][] = [
      'Strong Hire', 'Hire', 'No Hire', 'Strong No Hire'
    ];
    
    return validRecommendations.includes(recommendation as any) 
      ? recommendation as InterviewEvaluation['recommendation']
      : 'No Hire';
  }

  /**
   * Get color for rating score
   */
  getScoreColor(score: number): string {
    if (score >= 8) return '#10B981'; // green
    if (score >= 6.5) return '#F59E0B'; // amber
    if (score >= 4) return '#EF4444'; // red
    return '#7C2D12'; // dark red
  }

  /**
   * Get recommendation color
   */
  getRecommendationColor(recommendation: InterviewEvaluation['recommendation']): string {
    switch (recommendation) {
      case 'Strong Hire': return '#10B981';
      case 'Hire': return '#3B82F6';
      case 'No Hire': return '#EF4444';
      case 'Strong No Hire': return '#7C2D12';
      default: return '#6B7280';
    }
  }
}

export const interviewEvaluationService = new InterviewEvaluationService();
