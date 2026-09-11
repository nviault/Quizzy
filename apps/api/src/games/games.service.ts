import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { StoreService } from '../store/store.service';
import { Game, GameStatus, Player, PlayerResponse } from '@quizzy/types';
import { ScoringEngine } from '@quizzy/scoring';

@Injectable()
export class GamesService {
  private activeQuestionStartTimes = new Map<string, number>();

  constructor(private readonly store: StoreService) {}

  createGame(quizId: string, hostId: string = 'host'): Game {
    const quiz = this.store.getQuiz(quizId);
    if (!quiz) {
      throw new NotFoundException(`Quiz ${quizId} not found`);
    }

    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const game: Game = {
      id: `game-${Date.now()}`,
      quizId,
      hostId,
      pin,
      status: GameStatus.WAITING,
      currentQuestionIndex: -1
    };

    return this.store.saveGame(game);
  }

  getGame(gameId: string): Game {
    const game = this.store.getGame(gameId);
    if (!game) {
      throw new NotFoundException(`Game ${gameId} not found`);
    }
    return game;
  }

  getGameByPin(pin: string): Game {
    const game = this.store.getGameByPin(pin);
    if (!game) {
      throw new NotFoundException(`Partie introuvable avec le PIN ${pin}`);
    }
    return game;
  }

  joinGame(pin: string, nickname: string): { game: Game; player: Player } {
    const game = this.getGameByPin(pin);
    if (game.status !== GameStatus.WAITING) {
      throw new BadRequestException('La partie a déjà démarré ou est terminée');
    }

    const player: Player = {
      id: `player-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      gameId: game.id,
      nickname,
      score: 0,
      joinedAt: new Date().toISOString()
    };

    this.store.addPlayer(game.id, player);
    return { game, player };
  }

  startGame(gameId: string): Game {
    const game = this.getGame(gameId);
    if (game.status !== GameStatus.WAITING) {
      throw new BadRequestException('Invalid state transition to start game');
    }

    game.status = GameStatus.QUESTION_RUNNING;
    game.currentQuestionIndex = 0;
    game.startedAt = new Date().toISOString();

    this.store.saveGame(game);
    this.activeQuestionStartTimes.set(game.id, Date.now());

    return game;
  }

  nextQuestion(gameId: string): Game {
    const game = this.getGame(gameId);
    const quiz = this.store.getQuiz(game.quizId)!;

    if (game.currentQuestionIndex + 1 >= quiz.questions.length) {
      game.status = GameStatus.FINISHED;
      game.endedAt = new Date().toISOString();
    } else {
      game.status = GameStatus.QUESTION_RUNNING;
      game.currentQuestionIndex += 1;
      this.activeQuestionStartTimes.set(game.id, Date.now());
    }

    return this.store.saveGame(game);
  }

  submitAnswer(gameId: string, playerId: string, questionId: string, answerId: string): { score: number; isCorrect: boolean } {
    const game = this.getGame(gameId);
    if (game.status !== GameStatus.QUESTION_RUNNING) {
      throw new BadRequestException('La question n\'est pas en cours');
    }

    const quiz = this.store.getQuiz(game.quizId)!;
    const currentQuestion = quiz.questions[game.currentQuestionIndex];

    if (!currentQuestion || currentQuestion.id !== questionId) {
      throw new BadRequestException('Question non valide');
    }

    const startTime = this.activeQuestionStartTimes.get(game.id) || Date.now();
    const serverReceivedAt = Date.now();
    const responseTimeMs = serverReceivedAt - startTime;

    if (responseTimeMs > currentQuestion.durationMs + 2000) {
      throw new BadRequestException('Temps écoulé pour répondre');
    }

    const isCorrect = currentQuestion.correctAnswerId === answerId;
    const points = ScoringEngine.calculateScore({
      basePoints: currentQuestion.points,
      durationMs: currentQuestion.durationMs,
      responseTimeMs,
      isCorrect
    });

    const playerResponse: PlayerResponse = {
      id: `resp-${Date.now()}`,
      gameId,
      playerId,
      questionId,
      answerId,
      responseTimeMs,
      score: points,
      isCorrect,
      receivedAt: new Date(serverReceivedAt).toISOString()
    };

    const saved = this.store.saveResponse(gameId, questionId, playerResponse);
    if (!saved) {
      throw new BadRequestException('Vous avez déjà répondu à cette question');
    }

    if (points > 0) {
      this.store.updatePlayerScore(gameId, playerId, points);
    }

    return { score: points, isCorrect };
  }
}
