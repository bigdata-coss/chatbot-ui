import { ChatbotUIContext } from '@/context/context';
import { getAssistantCollectionsByAssistantId } from '@/db/assistant-collections';
import { getAssistantFilesByAssistantId } from '@/db/assistant-files';
import { getAssistantToolsByAssistantId } from '@/db/assistant-tools';
import { updateChat } from '@/db/chats';
import { getCollectionFilesByCollectionId } from '@/db/collection-files';
import { deleteMessagesIncludingAndAfter } from '@/db/messages';
import { buildFinalMessages } from '@/lib/build-prompt';
import { Tables } from '@/supabase/types';
import { ChatMessage, ChatPayload, LLMID, ModelProvider } from '@/types';
import { useRouter } from 'next/navigation';
import { useContext, useEffect, useRef } from 'react';
import { LLM_LIST } from '../../../lib/models/llm/llm-list';
import {
  createTempMessages,
  handleCreateChat,
  handleCreateMessages,
  handleHostedChat,
  handleLocalChat,
  handleRetrieval,
  processResponse,
  validateChatSettings
} from '../chat-helpers';
import { v4 as uuidv4 } from 'uuid';
import { cleanUpGameResults } from '@/db/games';

const submitQuestion = [
  '인공지능(AI), 머신 러닝(ML), 딥 러닝(DL)의 차이를 간단히 설명하세요.',
  'Open AI의 GPT 모델에서 대해서 설명하시오',
  '메타는 라마를 어떻게 활용하고 있는가?',
  '가트너 그룹이 발표한 Hyper Cycle for Artificial Intelligence 2024에 대해서 설명하고 Computer Vision 기술은 어디쯤 위치해 있는지 설명하시오.',
  '1981년과 1995년 그리고 2009과 2023년에 대해서 각각 어떤 IT 이슈가 있었는지 설명하고 당시 성장한 주요 업체들을 나열하시오',
  'Microsoft 가 OpenAI에 이제까지 투자하면서 얻은 것은 무엇인가?',
  '1990년대의 세계 최대의 부자들과 2020년의 최대 부자들을 비교하고 어떤 특이점이 있는지 기술하시오',
  'Microsoft의 사티아 CEO가 최근 Ignite 2024 행사에서 언급한 Scaling laws는 무엇인가?',
  '딥 러닝 모델의 파라메터 개수가 가지는 의미를 설명하시오',
  '제프리 힌튼 교수가 최근 노벨 상을 받았는데 어떤 분야이고 어떤 연구로 상을 받았는지 설명하시오',
  'LLM이 학습 과정에서 사용하는 "토큰화"의 의미는 무엇인가요?',
  'LLM에서 사용되는 "Attention Mechanism"의 주요 역할은 무엇인가요?',
  '"언어 모델의 overfitting"은 무엇을 의미하나요?',
  'LLM이 "인코더-디코더" 구조를 사용하는 경우, 그 역할을 설명하세요.',
  '"Masking" 기법이 LLM에서 활용되는 이유는 무엇인가요?',
  '"Positional Encoding"이 Transformer에서 중요한 이유는 무엇인가요?',
  'BERT 모델과 GPT 모델의 차이를 설명하세요.',
  '"Temperature" 파라미터가 텍스트 생성에 미치는 영향을 설명하세요.',
  'BERT와 GPT 모델이 사용하는 "토큰 임베딩"의 역할은 무엇인가요?',
  'GPT 모델이 텍스트를 생성할 때 "Auto-regressive 방식"이란 무엇인가요?',
  '"지식 전이(Transfer Learning)"가 언어 모델에 적용될 때 발생하는 주요 장점을 설명하세요.',
  'RLHF(인간 피드백을 통한 강화학습)의 주요 목적은 무엇인가요?',
  'RLHF가 기존 비지도 학습 방식과 비교해 생성 모델의 품질을 높이는 이유는 무엇인가요?',
  '임베딩(Embedding) 모델이 사용하는 "단어 임베딩"의 주요 목적은 무엇인가요?',
  '"임베딩 벡터의 차원 수(Dimensionality)"가 너무 크거나 작을 때 발생할 수 있는 문제는 무엇인가요?',
  '토크나이저의 주요 역할을 설명하세요.',
  '"토큰화 과정에서 발생할 수 있는 정보 손실" 문제를 설명하세요.',
  'LLM에서 "프롬프트(Prompt)"의 역할은 무엇인가요?',
  '"프롬프트 엔지니어링(Prompt Engineering)"이 중요한 이유를 설명하세요.',
  'GPT-3 모델과 GPT-4 모델의 주요 차이점 중 하나인 파라미터 수의 변화를 통해 기대할 수 있는 성능 향상은 무엇인가요?',
  '"프롬프트 엔지니어링(Prompt Engineering)"의 주요 목적은 무엇인가요?',
  '프롬프트 작성 시 모델의 "언어 이해 수준"을 고려해야 하는 이유는 무엇인가요?',
  '"Few-shot Prompting"과 "One-shot Prompting"의 차이를 설명하세요.',
  '프롬프트에 "명확한 지시어(Instruction)"를 포함하는 것이 중요한 이유는 무엇인가요?',
  '"프롬프트 길이"가 너무 길거나 짧을 때 발생할 수 있는 문제를 설명하세요.',
  '"디버깅을 위한 프롬프트 엔지니어링"은 어떤 방식으로 이루어지나요?',
  '"프롬프트에서 의도하지 않은 출력"을 방지하기 위한 방법은 무엇인가요?',
  '"다중 작업(Multi-task) 프롬프트" 작성 시 주의할 점을 설명하세요.',
  '프롬프트에 "제한 조건"을 설정할 때의 예시를 설명하세요.',
  '프롬프트 엔지니어링에서 "가이드 프롬프트"란 무엇인가요?',
  'LLM과 Agent의 주요 차이점을 설명하세요.',
  'On-Device AI의 주요 장점을 설명하세요.',
  'LLM 기반 Agent가 외부 API와 연동되는 경우의 장점을 설명하세요.',
  'LLM 기반 Agent가 "상태(State)를 유지하는 기능"이 필요한 이유는 무엇인가요?',
  'LLM Agent에서 "다중 에이전트 협업 시스템"의 개념을 설명하세요.',
  '"Meta-prompting"이 LLM Agent에서 사용되는 이유를 설명하세요.',
  'On-Device AI의 연산 속도를 향상시키기 위해 사용되는 하드웨어 기술을 설명하세요.',
  'M365에서 생산성 향상을 위해 도입된 대표적인 AI 기반 Agent의 이름은 무엇인가요?',
  '"에이전트를 다루는 에이전트(Meta-Agent)"의 주요 역할은 무엇인가요?',
  'Meta-Agent가 다중 에이전트 환경에서 "중재(Mediation)" 기능을 수행할 때 기대할 수 있는 효과는 무엇인가요?'
];

export const useChatHandler = () => {
  const router = useRouter();

  const {
    userInput,
    chatFiles,
    setUserInput,
    setNewMessageImages,
    profile,
    setIsGenerating,
    setChatMessages,
    setFirstTokenReceived,
    selectedChat,
    selectedWorkspace,
    setSelectedChat,
    setChats,
    setSelectedTools,
    availableLocalModels,
    availableOpenRouterModels,
    abortController,
    setAbortController,
    chatSettings,
    newMessageImages,
    selectedAssistant,
    chatMessages,
    chatImages,
    setChatImages,
    setChatFiles,
    setNewMessageFiles,
    setShowFilesDisplay,
    newMessageFiles,
    chatFileItems,
    setChatFileItems,
    setToolInUse,
    useRetrieval,
    sourceCount,
    setIsPromptPickerOpen,
    setIsFilePickerOpen,
    selectedTools,
    selectedPreset,
    setChatSettings,
    models,
    isPromptPickerOpen,
    isFilePickerOpen,
    isToolPickerOpen
  } = useContext(ChatbotUIContext);

  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isPromptPickerOpen || !isFilePickerOpen || !isToolPickerOpen) {
      chatInputRef.current?.focus();
    }
  }, [isPromptPickerOpen, isFilePickerOpen, isToolPickerOpen]);

  const handleNewChat = async () => {
    if (!selectedWorkspace) return;

    setUserInput('');
    setChatMessages([]);
    setSelectedChat(null);
    setChatFileItems([]);

    setIsGenerating(false);
    setFirstTokenReceived(false);

    setChatFiles([]);
    setChatImages([]);
    setNewMessageFiles([]);
    setNewMessageImages([]);
    setShowFilesDisplay(false);
    setIsPromptPickerOpen(false);
    setIsFilePickerOpen(false);

    setSelectedTools([]);
    setToolInUse('none');

    if (selectedAssistant) {
      setChatSettings({
        model: selectedAssistant.model as LLMID,
        prompt: selectedAssistant.prompt,
        temperature: selectedAssistant.temperature,
        contextLength: selectedAssistant.context_length,
        includeProfileContext: selectedAssistant.include_profile_context,
        includeWorkspaceInstructions:
          selectedAssistant.include_workspace_instructions,
        embeddingsProvider: selectedAssistant.embeddings_provider as
          | 'openai'
          | 'local'
      });

      let allFiles = [];

      const assistantFiles = (
        await getAssistantFilesByAssistantId(selectedAssistant.id)
      ).files;
      allFiles = [...assistantFiles];
      const assistantCollections = (
        await getAssistantCollectionsByAssistantId(selectedAssistant.id)
      ).collections;
      for (const collection of assistantCollections) {
        const collectionFiles = (
          await getCollectionFilesByCollectionId(collection.id)
        ).files;
        allFiles = [...allFiles, ...collectionFiles];
      }
      const assistantTools = (
        await getAssistantToolsByAssistantId(selectedAssistant.id)
      ).tools;

      setSelectedTools(assistantTools);
      setChatFiles(
        allFiles.map(file => ({
          id: file.id,
          name: file.name,
          type: file.type,
          file: null
        }))
      );

      if (allFiles.length > 0) setShowFilesDisplay(true);
    } else if (selectedPreset) {
      setChatSettings({
        model: selectedPreset.model as LLMID,
        prompt: selectedPreset.prompt,
        temperature: selectedPreset.temperature,
        contextLength: selectedPreset.context_length,
        includeProfileContext: selectedPreset.include_profile_context,
        includeWorkspaceInstructions:
          selectedPreset.include_workspace_instructions,
        embeddingsProvider: selectedPreset.embeddings_provider as
          | 'openai'
          | 'local'
      });
    } else if (selectedWorkspace) {
      // setChatSettings({
      //   model: (selectedWorkspace.default_model ||
      //     "gpt-4-1106-preview") as LLMID,
      //   prompt:
      //     selectedWorkspace.default_prompt ||
      //     "You are a friendly, helpful AI assistant.",
      //   temperature: selectedWorkspace.default_temperature || 0.5,
      //   contextLength: selectedWorkspace.default_context_length || 4096,
      //   includeProfileContext:
      //     selectedWorkspace.include_profile_context || true,
      //   includeWorkspaceInstructions:
      //     selectedWorkspace.include_workspace_instructions || true,
      //   embeddingsProvider:
      //     (selectedWorkspace.embeddings_provider as "openai" | "local") ||
      //     "openai"
      // })
    }

    return router.push(`/${selectedWorkspace.id}/chat`);
  };

  const handleFocusChatInput = () => {
    chatInputRef.current?.focus();
  };

  const handleStopMessage = () => {
    if (abortController) {
      abortController.abort();
    }
  };

  const handleSendMessage = async (
    messageContent: string,
    chatMessages: ChatMessage[],
    isRegeneration: boolean
  ) => {
    const startingInput = messageContent;

    try {
      setUserInput('');
      setIsGenerating(true);
      setIsPromptPickerOpen(false);
      setIsFilePickerOpen(false);
      setNewMessageImages([]);

      const newAbortController = new AbortController();
      setAbortController(newAbortController);

      const modelData = [
        ...models.map(model => ({
          modelId: model.model_id as LLMID,
          modelName: model.name,
          provider: 'custom' as ModelProvider,
          hostedId: model.id,
          platformLink: '',
          imageInput: false
        })),
        ...LLM_LIST,
        ...availableLocalModels,
        ...availableOpenRouterModels
      ].find(llm => llm.modelId === chatSettings?.model);

      validateChatSettings(
        chatSettings,
        modelData,
        profile,
        selectedWorkspace,
        messageContent
      );

      let currentChat = selectedChat ? { ...selectedChat } : null;

      const b64Images = newMessageImages.map(image => image.base64);

      let retrievedFileItems: Tables<'file_items'>[] = [];

      if (
        (newMessageFiles.length > 0 || chatFiles.length > 0) &&
        useRetrieval
      ) {
        setToolInUse('retrieval');

        retrievedFileItems = await handleRetrieval(
          userInput,
          newMessageFiles,
          chatFiles,
          chatSettings!.embeddingsProvider,
          sourceCount
        );
      }

      const { tempUserChatMessage, tempAssistantChatMessage } =
        createTempMessages(
          messageContent,
          chatMessages,
          chatSettings!,
          b64Images,
          isRegeneration,
          setChatMessages,
          selectedAssistant
        );

      const payload: ChatPayload = {
        chatSettings: chatSettings!,
        workspaceInstructions: selectedWorkspace!.instructions || '',
        chatMessages: isRegeneration
          ? [...chatMessages]
          : [...chatMessages, tempUserChatMessage],
        assistant: selectedChat?.assistant_id ? selectedAssistant : null,
        messageFileItems: retrievedFileItems,
        chatFileItems: chatFileItems,
        questionId: null
      };

      let generatedText = '';

      if (selectedTools.length > 0) {
        setToolInUse('Tools');

        const formattedMessages = await buildFinalMessages(
          payload,
          profile!,
          chatImages
        );

        const response = await fetch('/api/chat/tools', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chatSettings: payload.chatSettings,
            messages: formattedMessages,
            selectedTools
          })
        });

        setToolInUse('none');

        generatedText = await processResponse(
          response,
          isRegeneration
            ? payload.chatMessages[payload.chatMessages.length - 1]
            : tempAssistantChatMessage,
          true,
          newAbortController,
          setFirstTokenReceived,
          setChatMessages,
          setToolInUse
        );
      } else {
        if (modelData!.provider === 'ollama') {
          generatedText = await handleLocalChat(
            payload,
            profile!,
            chatSettings!,
            tempAssistantChatMessage,
            isRegeneration,
            newAbortController,
            setIsGenerating,
            setFirstTokenReceived,
            setChatMessages,
            setToolInUse
          );
        } else {
          generatedText = await handleHostedChat(
            payload,
            profile!,
            modelData!,
            tempAssistantChatMessage,
            isRegeneration,
            newAbortController,
            newMessageImages,
            chatImages,
            setIsGenerating,
            setFirstTokenReceived,
            setChatMessages,
            setToolInUse
          );
        }
      }

      if (!currentChat) {
        currentChat = await handleCreateChat(
          chatSettings!,
          profile!,
          selectedWorkspace!,
          messageContent,
          selectedAssistant!,
          newMessageFiles,
          setSelectedChat,
          setChats,
          setChatFiles
        );
      } else {
        const updatedChat = await updateChat(currentChat.id, {
          updated_at: new Date().toISOString()
        });

        setChats(prevChats => {
          const updatedChats = prevChats.map(prevChat =>
            prevChat.id === updatedChat.id ? updatedChat : prevChat
          );

          return updatedChats;
        });
      }

      await handleCreateMessages(
        chatMessages,
        currentChat,
        profile!,
        modelData!,
        messageContent,
        generatedText,
        newMessageImages,
        isRegeneration,
        retrievedFileItems,
        setChatMessages,
        setChatFileItems,
        setChatImages,
        selectedAssistant
      );

      setIsGenerating(false);
      setFirstTokenReceived(false);
    } catch (error) {
      setIsGenerating(false);
      setFirstTokenReceived(false);
      setUserInput(startingInput);
    }
  };

  const handleSubmitMessage = async (
    messageContent: string,
    chatMessages: ChatMessage[],
    isRegeneration: boolean
  ) => {
    const startingInput = messageContent;

    // overwrite chatMessages
    chatMessages = [];

    try {
      setUserInput('');
      setIsGenerating(true);
      setIsPromptPickerOpen(false);
      setIsFilePickerOpen(false);
      setNewMessageImages([]);

      const newAbortController = new AbortController();
      setAbortController(newAbortController);

      const modelData = [
        ...models.map(model => ({
          modelId: model.model_id as LLMID,
          modelName: model.name,
          provider: 'finetuned' as ModelProvider,
          hostedId: model.id,
          platformLink: '',
          imageInput: false
        })),
        ...LLM_LIST,
        ...availableLocalModels,
        ...availableOpenRouterModels
      ].find(llm => llm.modelId === chatSettings?.model);

      validateChatSettings(
        chatSettings,
        modelData,
        profile,
        selectedWorkspace,
        'submit'
      );

      let currentChat = selectedChat ? { ...selectedChat } : null;

      const b64Images = newMessageImages.map(image => image.base64);

      let count = 0;
      const questionId = uuidv4();
      for (const question of submitQuestion) {
        console.log('question', question);
        count++;
        messageContent = question;

        let retrievedFileItems: Tables<'file_items'>[] = [];

        if (
          (newMessageFiles.length > 0 || chatFiles.length > 0) &&
          useRetrieval
        ) {
          setToolInUse('retrieval');

          retrievedFileItems = await handleRetrieval(
            question,
            newMessageFiles,
            chatFiles,
            chatSettings!.embeddingsProvider,
            sourceCount
          );

          // use first file item to get the file
          if (retrievedFileItems.length >= 1) {
            retrievedFileItems = retrievedFileItems.slice(0, 1);
          }
          // console.log('retrievedFileItems', retrievedFileItems);
        }

        const tempUserChatMessage: ChatMessage = {
          message: {
            chat_id: '',
            assistant_id: null,
            content: messageContent,
            created_at: '',
            id: uuidv4(),
            image_paths: b64Images,
            model: 'FineTuning_LLM',
            role: 'user',
            sequence_number: chatMessages.length,
            updated_at: '',
            user_id: ''
          },
          fileItems: []
        };

        const tempAssistantChatMessage: ChatMessage = {
          message: {
            chat_id: '',
            assistant_id: selectedAssistant?.id || null,
            content: '',
            created_at: '',
            id: uuidv4(),
            image_paths: [],
            model: 'FineTuning_LLM',
            role: 'assistant',
            sequence_number: chatMessages.length + 1,
            updated_at: '',
            user_id: ''
          },
          fileItems: []
        };

        const payload: ChatPayload = {
          chatSettings: chatSettings!,
          workspaceInstructions: selectedWorkspace!.instructions || '',
          chatMessages: isRegeneration
            ? [...chatMessages]
            : [...chatMessages, tempUserChatMessage],
          assistant: selectedChat?.assistant_id ? selectedAssistant : null,
          messageFileItems: retrievedFileItems,
          chatFileItems: chatFileItems,
          questionId: questionId
        };

        payload.workspaceInstructions = count + '';
        console.log('payload', payload);

        let generatedText = '';

        generatedText = await handleHostedChat(
          payload,
          profile!,
          modelData!,
          tempAssistantChatMessage,
          isRegeneration,
          newAbortController,
          newMessageImages,
          chatImages,
          null,
          setFirstTokenReceived,
          null,
          setToolInUse
        );
        console.log('generatedText', generatedText);
      }

      // cleanup
      if (profile) {
        cleanUpGameResults(profile.user_id);
      }

      setIsGenerating(false);
      setFirstTokenReceived(false);
    } catch (error) {
      setIsGenerating(false);
      setFirstTokenReceived(false);
      setUserInput(startingInput);
    }
  };

  const handleSendEdit = async (
    editedContent: string,
    sequenceNumber: number
  ) => {
    if (!selectedChat) return;

    await deleteMessagesIncludingAndAfter(
      selectedChat.user_id,
      selectedChat.id,
      sequenceNumber
    );

    const filteredMessages = chatMessages.filter(
      chatMessage => chatMessage.message.sequence_number < sequenceNumber
    );

    setChatMessages(filteredMessages);

    handleSendMessage(editedContent, [], false);
  };

  return {
    chatInputRef,
    prompt,
    handleNewChat,
    handleSendMessage,
    handleFocusChatInput,
    handleStopMessage,
    handleSendEdit,
    handleSubmitMessage
  };
};
