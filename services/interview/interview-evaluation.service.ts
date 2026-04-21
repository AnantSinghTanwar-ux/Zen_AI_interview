import {
  generateOpenRouterJson,
  getOpenRouterModelCandidates,
  hasOpenRouterKey,
} from '@/services/ai/openrouter-client';
import { applyStructuredEvaluationGuardrails } from '@/services/ai/analysis-guardrails';

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
  private initialized = false;
  private available = false;

  constructor() {
    // Don't initialize immediately - do it lazily when needed
  }

  private initialize() {
    if (this.initialized) return;

    if (!hasOpenRouterKey()) {
      console.warn('OpenRouter API key not found. Interview evaluation will not be available.');
      this.available = false;
    } else {
      this.available = true;
      console.log('Interview evaluation service initialized with OpenRouter');
    }

    this.initialized = true;
  }

  /**
   * Check if the service is available
   */
  isAvailable(): boolean {
    this.initialize();
    return this.available;
  }

  /**
   * Evaluate interview performance based on conversation transcript
   */
  async evaluateInterview(messages: any[], callDetails: any): Promise<InterviewEvaluation> {
    // Initialize and check if service is available
    this.initialize();
    
    if (!this.isAvailable()) {
      throw new Error('Interview evaluation service is not available. Please configure OPENROUTER_API_KEY.');
    }

    try {
      // Extract conversation transcript
      const transcript = this.extractConversationTranscript(messages);
      
      if (!transcript || transcript.trim().length === 0) {
        throw new Error('No conversation content found to evaluate');
      }
      
      // Create comprehensive evaluation prompt
      const prompt = this.createEvaluationPrompt(transcript, callDetails);
      
      const evaluation = await generateOpenRouterJson<any>({
        prompt,
        modelCandidates: getOpenRouterModelCandidates(
          process.env.OPENROUTER_HARSH_ANALYSIS_MODEL,
          process.env.OPENROUTER_EVALUATION_MODEL,
          'openai/gpt-4.1-mini',
          process.env.OPENROUTER_MODEL,
          process.env.GOOGLE_AI_FEEDBACK_MODEL,
          'openrouter/auto'
        ),
        temperature: 0.1,
        maxTokens: 4_000,
      });
      
      // Validate and sanitize the evaluation
      return this.validateEvaluation(evaluation, transcript);

    } catch (error) {
      console.error('Error evaluating interview:', error);
      
      if (error instanceof Error) {
        // Handle specific API errors
        if (error.message.includes('429') || error.message.includes('quota')) {
          throw new Error('API quota exceeded. Please try again later or adjust your OpenRouter limits.');
        }
        if (error.message.includes('403') || error.message.includes('API key')) {
          throw new Error('Invalid API key. Please check your OpenRouter API key configuration.');
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
    * Create comprehensive evaluation prompt for OpenRouter
   */
  private createEvaluationPrompt(transcript: string, callDetails: any): string {
    return `
You are a strict hiring-panel evaluator for real-world software engineering interviews.

MANDATORY RULES:
1) Score ONLY demonstrated interview evidence from transcript content.
2) Resume references are context, not proof of technical ability.
3) Use conservative scoring by default; do not inflate based on politeness or potential.
4) If technical depth is missing, technicalKnowledge and problemSolving MUST stay low.
5) If there is no code/system-design discussion, codeQuality/systemDesign cannot be high.
6) Default recommendation should be No Hire unless transcript shows repeated strong evidence.

INTERVIEW DETAILS:
- Duration: ${callDetails.duration || 'Unknown'}
- Status: ${callDetails.status}
- Message Count: ${callDetails.messageCount || 0}

TRANSCRIPT:
${transcript}

Return ONLY valid JSON using this exact structure:

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

EVIDENCE CAP RULES (must apply):
- If there is no clear technical Q&A depth: technicalKnowledge <= 3
- If there is no concrete solution walkthrough: problemSolving <= 3
- If no code-level discussion appears: codeQuality <= 3
- If no architecture/scalability discussion appears: systemDesign <= 3
- If responses are short/deflecting: communication/confidence should be penalized

RECOMMENDATIONS:
- "Strong Hire": Rare, clearly exceptional evidence (Overall 9.2-10)
- "Hire": Interview-ready with consistent depth (Overall 8.0-9.1)
- "No Hire": Not interview-ready / inconsistent evidence (Overall 5.8-7.9)
- "Strong No Hire": Clear mismatch or very weak evidence (Overall 1-5.7)

Be direct, realistic, and strict. Keep "detailedFeedback" concise (under 200 words) and grounded in transcript evidence.

Return ONLY the JSON object, no additional text. Ensure the JSON is valid standard JSON (no trailing commas, keys in double quotes).
    `;
  }

  /**
   * Validate and sanitize evaluation response
   */
  private validateEvaluation(evaluation: any, transcript: string): InterviewEvaluation {
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

    return applyStructuredEvaluationGuardrails(sanitized, transcript) as InterviewEvaluation;
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
