import { TablesInsert, TablesUpdate } from '@/supabase/types';
import { ChatSettings } from '@/types';
import { ServerRuntime } from 'next';
import OpenAI from 'openai';
import { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions.mjs';
import { getServerProfile } from '@/lib/server/server-chat-helpers';
import { wrapOpenAI } from 'langsmith/wrappers';
import { createGame } from '@/db/games';
import { getFileById } from '@/db/files';
export const runtime = 'nodejs';
// export const runtime: ServerRuntime = 'edge';

export async function POST(request: Request) {
  const json = await request.json();

  let {
    question_id,
    chatSettings,
    messages,
    customModelId,
    question,
    prompt,
    context,
    file
  } = json as {
    question_id: string;
    chatSettings: ChatSettings;
    messages: any[];
    customModelId: string;
    question: string;
    prompt: string;
    context: string;
    file: string;
  };

  console.log('question_id:', question_id);

  if (prompt.length > 5000) {
    prompt = prompt.substring(0, 4900) + '...';
  }
  if (context.length > 5000) {
    context = context.substring(0, 4900) + '...';
  }

  // convert customModelId to int
  const customModelIdInt = parseInt(customModelId);

  try {
    const profile = await getServerProfile();

    const url = 'https://ryeon.elpai.org/submit/v1';
    const model = 'olympiad';

    let fileName = file;
    if (file !== '') {
      file = file.trim();
      const fileDB = (await getFileById(file)) as TablesUpdate<'files'>;
      if (fileDB) {
        //@ts-ignore
        fileName = fileDB.name;
      }
    }

    const openai = wrapOpenAI(
      new OpenAI({
        baseURL: url,
        defaultHeaders: {
          'Content-Type': 'application/json',
          'Question-ID': customModelIdInt.toString()
        }
      }),
      {
        name: chatSettings.model,
        tags: [
          profile.display_name,
          profile.user_id,
          profile.team ? profile.team : 'unknown team',
          profile.department ? profile.department : 'unknown department'
        ]
      }
    );

    const response = await openai.chat.completions.create({
      model: model,
      messages: messages as ChatCompletionCreateParamsBase['messages'],
      temperature: chatSettings.temperature,
      max_tokens: null,
      stream: false
    });

    //@ts-ignore
    let response_response = response.result.response;
    console.log('response_response:', response_response);
    if (response_response.length > 5000) {
      response_response = response_response.substring(0, 4900) + '...';
    }

    //@ts-ignore
    let response_reasoning = response.result.reasoning;
    console.log('response_reasoning:', response_reasoning);
    if (response_reasoning.length > 5000) {
      response_reasoning = response_reasoning.substring(0, 4900) + '...';
    }

    //@ts-ignore
    let response_score = parseFloat(response.result.score);

    console.log('createGame:');
    await createGame({
      name: chatSettings.model,
      created_at: new Date().toISOString(),
      question_id: question_id.toString(),
      question_num: 1,
      question_count: 0,
      game_type: 'finetuning',
      question: question,
      prompt: prompt,
      context: context,
      file: fileName,
      score: response_score,
      response: response_response,
      reason: response_reasoning,
      updated_at: new Date().toISOString(),
      user_id: profile.user_id
    } as TablesInsert<'game_results'>);

    return new Response(
      //@ts-ignore
      JSON.stringify('채점완료.'),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error: any) {
    let errorMessage = error.message || 'An unexpected error occurred';
    const errorCode = error.status || 500;

    if (errorMessage.toLowerCase().includes('api key not found')) {
      errorMessage =
        'Custom API Key not found. Please set it in your profile settings.';
    } else if (errorMessage.toLowerCase().includes('incorrect api key')) {
      errorMessage =
        'Custom API Key is incorrect. Please fix it in your profile settings.';
    }

    return new Response(
      JSON.stringify({
        message: 'error: ' + errorMessage
      }),
      {
        status: errorCode
      }
    );
  }
}
