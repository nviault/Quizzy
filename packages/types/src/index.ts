export enum GameStatus {
  WAITING = 'WAITING',
  QUESTION_RUNNING = 'QUESTION_RUNNING',
  QUESTION_ENDED = 'QUESTION_ENDED',
  RESULTS = 'RESULTS',
  FINISHED = 'FINISHED'
}

export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  TRUE_FALSE = 'TRUE_FALSE'
}

export interface AnswerOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  quizId: string;
  position: number;
  type: QuestionType;
  text: string;
  durationMs: number;
  points: number;
  mediaUrl?: string;
  answers: AnswerOption[];
}

export interface QuestionWithCorrectAnswer extends Question {
  correctAnswerId: string;
}

export interface Quiz {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  questions: QuestionWithCorrectAnswer[];
  createdAt: string;
  updatedAt: string;
}

export interface Game {
  id: string;
  quizId: string;
  hostId: string;
  pin: string;
  status: GameStatus;
  currentQuestionIndex: number;
  startedAt?: string;
  endedAt?: string;
}

export interface Player {
  id: string;
  gameId: string;
  nickname: string;
  score: number;
  joinedAt: string;
}

export interface PlayerResponse {
  id: string;
  gameId: string;
  playerId: string;
  questionId: string;
  answerId: string;
  responseTimeMs: number;
  score: number;
  isCorrect: boolean;
  receivedAt: string;
}

export interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  score: number;
  rank: number;
}
