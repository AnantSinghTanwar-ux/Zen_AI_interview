import { EmotionData } from '@/services/emotion/emotion-detection.service';

enum MessageTypeEnum {
  TRANSCRIPT = "transcript",
  FUNCTION_CALL = "function-call",
  FUNCTION_CALL_RESULT = "function-call-result",
  ADD_MESSAGE = "add-message",
}

enum MessageRoleEnum {
  USER = "user",
  SYSTEM = "system",
  ASSISTANT = "assistant",
}

enum TranscriptMessageTypeEnum {
  PARTIAL = "partial",
  FINAL = "final",
}

interface BaseMessage {
  type: MessageTypeEnum;
  timestamp?: number;
  emotionData?: EmotionData;
}

interface TranscriptMessage extends BaseMessage {
  type: MessageTypeEnum.TRANSCRIPT;
  role: MessageRoleEnum;
  transcriptType: TranscriptMessageTypeEnum;
  transcript: string;
  emotionData?: EmotionData;
}

interface FunctionCallMessage extends BaseMessage {
  type: MessageTypeEnum.FUNCTION_CALL;
  functionCall: {
    name: string;
    parameters: unknown;
  };
}

interface FunctionCallResultMessage extends BaseMessage {
  type: MessageTypeEnum.FUNCTION_CALL_RESULT;
  functionCallResult: {
    forwardToClientEnabled?: boolean;
    result: unknown;
    [a: string]: unknown;
  };
}

// Enhanced message type with emotion data
interface EnhancedMessage {
  role: 'user' | 'assistant' | 'system';
  message: string;
  time?: number;
  timestamp?: string;
  duration?: number;
  source?: string;
  endTime?: number;
  secondsFromStart?: number;
  emotionData?: EmotionData;
}

type Message =
  | TranscriptMessage
  | FunctionCallMessage
  | FunctionCallResultMessage;

// Call data structure for saved calls
interface SavedCallData {
  id: string;
  vapiCallId: string;
  userId?: string;
  assistantId?: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  duration?: number;
  cost?: number;
  costBreakdown?: {
    llm: number;
    stt: number;
    tts: number;
    vapi: number;
    total: number;
  };
  messages?: Message[];
  transcript?: string;
  summary?: string;
  recordingUrl?: string;
  transcriptUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export { 
  MessageTypeEnum, 
  MessageRoleEnum, 
  TranscriptMessageTypeEnum,
  BaseMessage,
  TranscriptMessage,
  FunctionCallMessage,
  FunctionCallResultMessage,
  EnhancedMessage,
  Message,
  SavedCallData
};
