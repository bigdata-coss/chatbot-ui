import { Tables } from '@/supabase/types';
import { ChatMessage, LLMID } from '.';
import { UUID } from 'node:crypto';

export interface ChatSettings {
  model: LLMID;
  prompt: string;
  temperature: number;
  contextLength: number;
  includeProfileContext: boolean;
  includeWorkspaceInstructions: boolean;
  embeddingsProvider: 'openai' | 'local';
}

export interface ChatPayload {
  chatSettings: ChatSettings;
  workspaceInstructions: string;
  chatMessages: ChatMessage[];
  assistant: Tables<'assistants'> | null;
  messageFileItems: Tables<'file_items'>[];
  chatFileItems: Tables<'file_items'>[];
  questionId: string | null;
}

export interface ChatAPIPayload {
  chatSettings: ChatSettings;
  messages: Tables<'messages'>[];
}
