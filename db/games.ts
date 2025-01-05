import { supabase } from '@/lib/supabase/browser-client';
import { TablesInsert, TablesUpdate } from '@/supabase/types';

export const getGameResults = async () => {
  const { data: games, error } = await supabase
    .from('game_results')
    .select('*');

  if (error) {
    throw new Error(error.message);
  }

  return games;
};

export const getGameResultByQuestionId = async (questionId: number) => {
  const { data: game, error } = await supabase
    .from('game_results')
    .select('*')
    .eq('question_id', questionId);

  if (error) {
    throw new Error(error.message);
  }

  return game;
};

export const getGameResultByGameType = async (gameType: string) => {
  const { data: game, error } = await supabase
    .from('game_results')
    .select('*')
    .eq('game_type', gameType);

  if (error) {
    throw new Error(error.message);
  }

  return game;
};

export const getGameResultWorkspacesByGameId = async (gameId: string) => {
  const { data: game, error } = await supabase
    .from('game_results')
    .select(
      `
        id,
        name,
        workspaces (*)
        `
    )
    .eq('id', gameId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return game;
};
export const getGameResultByID = async (id: string) => {
  const { data: game } = await supabase
    .from('game_results')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  return game;
};

export const getGameResultByUserIDAndGameIdAndType = async (
  userId: string,
  questionId: number,
  gameType: string
) => {
  const { data: game } = await supabase
    .from('game_results')
    .select('*')
    .eq('user_id', userId)
    .eq('question_id', questionId)
    .eq('game_type', gameType)
    .maybeSingle();

  return game;
};

export const createGame = async (game: TablesInsert<'game_results'>) => {
  const { data: createdGame, error } = await supabase
    .from('game_results')
    .insert([game])
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return createdGame;
};

export const updateGameScore = async (gameId: string, score: number) => {
  const { data: updatedGame, error } = await supabase
    .from('game_results')
    .update({ score: score })
    .eq('id', gameId)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return updatedGame;
};

export const updateGameQuestionCount = async (
  gameId: string,
  questionCount: number
) => {
  const { data: updatedGame, error } = await supabase
    .from('game_results')
    .update({ question_count: questionCount })
    .eq('id', gameId)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return updatedGame;
};

export const deleteGameResult = async (gameId: string) => {
  const { error } = await supabase
    .from('game_results')
    .delete()
    .eq('id', gameId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
};

export const updateGameResult = async (
  gameId: string,
  gameResult: TablesUpdate<'game_results'>
) => {
  const { data: updatedGameResult, error } = await supabase
    .from('game_results')
    .update(gameResult)
    .eq('id', gameId)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return updatedGameResult;
};

export const cleanUpGameResults = async (userId: string) => {
  // 1. 동일한 user_id의 question_id와 score 데이터를 가져오기
  const { data: gameResults, error } = await supabase
    .from('game_results')
    .select('question_id, score')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Error fetching game results: ${error.message}`);
  }

  if (!gameResults || gameResults.length === 0) {
    console.log('No game results found for this user.');
    return;
  }

  // 2. question_id별로 score 합산
  const scoresByQuestionId = gameResults.reduce(
    (acc, item) => {
      if (!acc[item.question_id]) {
        acc[item.question_id] = 0;
      }
      acc[item.question_id] += item.score || 0;
      return acc;
    },
    {} as Record<string, number>
  );

  // 3. score 합산 기준으로 상위 3개의 question_id 추출
  const topQuestionIds = Object.entries(scoresByQuestionId)
    .sort(([, scoreA], [, scoreB]) => scoreB - scoreA) // 내림차순 정렬
    .slice(0, 3) // 상위 3개만 추출
    .map(([question_id]) => question_id);

  // 4. 삭제 대상인 question_id 찾기
  const questionIdsToDelete = Object.keys(scoresByQuestionId).filter(
    question_id => !topQuestionIds.includes(question_id)
  );

  // 5. 삭제 로직 실행
  if (questionIdsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('game_results')
      .delete()
      .in('question_id', questionIdsToDelete);

    if (deleteError) {
      throw new Error(`Error deleting rows: ${deleteError.message}`);
    }

    console.log('Deleted question_ids:', questionIdsToDelete);
  } else {
    console.log('No question_ids to delete.');
  }

  return {
    topQuestionIds,
    deletedQuestionIds: questionIdsToDelete
  };
};
