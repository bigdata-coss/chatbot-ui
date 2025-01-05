-- 기존 열 삭제
ALTER TABLE game_results
DROP COLUMN question_id;

ALTER TABLE game_results
    ADD COLUMN question_num INT DEFAULT 0 NOT NULL, -- 기본값 0 추가
    ADD COLUMN question_id UUID NOT NULL;
