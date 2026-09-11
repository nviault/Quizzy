import { GameStatus, LeaderboardEntry, AnswerOption } from '@kahoot/types';

export enum EventType {
  PLAYER_JOINED = 'PLAYER_JOINED',
  PLAYER_LEFT = 'PLAYER_LEFT',
  GAME_STARTED = 'GAME_STARTED',
  QUESTION_STARTED = 'QUESTION_STARTED',
  ANSWER_SUBMITTED = 'ANSWER_SUBMITTED',
  QUESTION_ENDED = 'QUESTION_ENDED',
  SCORE_UPDATED = 'SCORE_UPDATED',
  LEADERBOARD_UPDATED = 'LEADERBOARD_UPDATED',
  GAME_FINISHED = 'GAME_FINISHED',
  SYNC_STATE = 'SYNC_STATE'
}

export interface BaseEvent {
  type: EventType;
  gameId: string;
  sequence: number;
  serverTime: number;
}

export interface PlayerJoinedEvent extends BaseEvent {
  type: EventType.PLAYER_JOINED;
  player: { id: string; nickname: string; score: number };
  playerCount: number;
}

export interface GameStartedEvent extends BaseEvent {
  type: EventType.GAME_STARTED;
  quizTitle: string;
  totalQuestions: number;
}

export interface QuestionStartedEvent extends BaseEvent {
  type: EventType.QUESTION_STARTED;
  questionIndex: number;
  totalQuestions: number;
  questionId: string;
  text: string;
  durationMs: number;
  answers: AnswerOption[];
  mediaUrl?: string;
  deadline: number;
}

export interface AnswerSubmittedEvent extends BaseEvent {
  type: EventType.ANSWER_SUBMITTED;
  playerId: string;
  questionId: string;
}

export interface QuestionEndedEvent extends BaseEvent {
  type: EventType.QUESTION_ENDED;
  questionIndex: number;
  correctAnswerId: string;
  answerCounts: Record<string, number>;
}

export interface LeaderboardUpdatedEvent extends BaseEvent {
  type: EventType.LEADERBOARD_UPDATED;
  leaderboard: LeaderboardEntry[];
}

export interface GameFinishedEvent extends BaseEvent {
  type: EventType.GAME_FINISHED;
  finalLeaderboard: LeaderboardEntry[];
}
