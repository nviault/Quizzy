import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Game, GameStatus, Player, PlayerResponse, Quiz, LeaderboardEntry } from '@quizzy/types';
import Redis from 'ioredis';

@Injectable()
export class StoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StoreService.name);
  private redisClient?: Redis;
  private isRedisConnected = false;

  private quizzes = new Map<string, Quiz>();
  private games = new Map<string, Game>();
  private players = new Map<string, Map<string, Player>>();
  private responses = new Map<string, Map<string, PlayerResponse[]>>();
  private gameSequences = new Map<string, number>();

  async onModuleInit() {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

    try {
      this.redisClient = new Redis({
        host: redisHost,
        port: redisPort,
        retryStrategy: () => null,
        lazyConnect: true
      });
      await this.redisClient.connect();
      this.isRedisConnected = true;
      this.logger.log(`Connected to Redis at ${redisHost}:${redisPort}`);
    } catch (err) {
      this.logger.warn(`Redis unavailable (${(err as Error).message}), operating with in-memory store.`);
      this.isRedisConnected = false;
    }

    this.seedDefaultQuizzes();
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }

  private seedDefaultQuizzes() {
    const sampleQuiz: Quiz = {
      id: 'quiz-demo-1',
      ownerId: 'admin',
      title: 'Culture Générale & Kubernetes',
      description: 'Un quiz de démonstration pour tester la plateforme Quizzy Open Source',
      visibility: 'PUBLIC',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questions: [
        {
          id: 'q1',
          quizId: 'quiz-demo-1',
          position: 1,
          type: 'MULTIPLE_CHOICE' as any,
          text: 'Quelle est la capitale de l\'Australie ?',
          durationMs: 15000,
          points: 1000,
          correctAnswerId: 'a2',
          answers: [
            { id: 'a1', text: 'Sydney' },
            { id: 'a2', text: 'Canberra' },
            { id: 'a3', text: 'Melbourne' },
            { id: 'a4', text: 'Perth' }
          ]
        },
        {
          id: 'q2',
          quizId: 'quiz-demo-1',
          position: 2,
          type: 'MULTIPLE_CHOICE' as any,
          text: 'Quel composant Kubernetes maintient l\'état souhaité des Pods ?',
          durationMs: 15000,
          points: 1000,
          correctAnswerId: 'a3',
          answers: [
            { id: 'a1', text: 'Kubelet' },
            { id: 'a2', text: 'etcd' },
            { id: 'a3', text: 'Kube-Controller-Manager' },
            { id: 'a4', text: 'Kube-Proxy' }
          ]
        },
        {
          id: 'q3',
          quizId: 'quiz-demo-1',
          position: 3,
          type: 'TRUE_FALSE' as any,
          text: 'NestJS utilise par défaut Express comme serveur HTTP sous-jacent.',
          durationMs: 10000,
          points: 1000,
          correctAnswerId: 'a1',
          answers: [
            { id: 'a1', text: 'Vrai' },
            { id: 'a2', text: 'Faux' }
          ]
        }
      ]
    };

    this.saveQuiz(sampleQuiz);
  }

  saveQuiz(quiz: Quiz): Quiz {
    this.quizzes.set(quiz.id, quiz);
    return quiz;
  }

  getQuiz(id: string): Quiz | undefined {
    return this.quizzes.get(id);
  }

  getAllQuizzes(): Quiz[] {
    return Array.from(this.quizzes.values());
  }

  saveGame(game: Game): Game {
    this.games.set(game.id, game);
    if (!this.players.has(game.id)) {
      this.players.set(game.id, new Map());
    }
    if (!this.responses.has(game.id)) {
      this.responses.set(game.id, new Map());
    }
    if (!this.gameSequences.has(game.id)) {
      this.gameSequences.set(game.id, 0);
    }
    return game;
  }

  getGame(gameId: string): Game | undefined {
    return this.games.get(gameId);
  }

  getGameByPin(pin: string): Game | undefined {
    for (const game of this.games.values()) {
      if (game.pin === pin && game.status !== GameStatus.FINISHED) {
        return game;
      }
    }
    return undefined;
  }

  getNextSequence(gameId: string): number {
    const current = this.gameSequences.get(gameId) || 0;
    const next = current + 1;
    this.gameSequences.set(gameId, next);
    return next;
  }

  addPlayer(gameId: string, player: Player): Player {
    let gamePlayers = this.players.get(gameId);
    if (!gamePlayers) {
      gamePlayers = new Map();
      this.players.set(gameId, gamePlayers);
    }
    gamePlayers.set(player.id, player);
    return player;
  }

  getPlayers(gameId: string): Player[] {
    const gamePlayers = this.players.get(gameId);
    return gamePlayers ? Array.from(gamePlayers.values()) : [];
  }

  getPlayer(gameId: string, playerId: string): Player | undefined {
    return this.players.get(gameId)?.get(playerId);
  }

  updatePlayerScore(gameId: string, playerId: string, pointsToAdd: number): number {
    const player = this.getPlayer(gameId, playerId);
    if (player) {
      player.score += pointsToAdd;
      return player.score;
    }
    return 0;
  }

  saveResponse(gameId: string, questionId: string, response: PlayerResponse): boolean {
    let gameResponses = this.responses.get(gameId);
    if (!gameResponses) {
      gameResponses = new Map();
      this.responses.set(gameId, gameResponses);
    }

    let qResponses = gameResponses.get(questionId);
    if (!qResponses) {
      qResponses = [];
      gameResponses.set(questionId, qResponses);
    }

    const existing = qResponses.find(r => r.playerId === response.playerId);
    if (existing) {
      return false;
    }

    qResponses.push(response);
    return true;
  }

  getQuestionResponses(gameId: string, questionId: string): PlayerResponse[] {
    return this.responses.get(gameId)?.get(questionId) || [];
  }

  getLeaderboard(gameId: string): LeaderboardEntry[] {
    const players = this.getPlayers(gameId);
    const sorted = [...players].sort((a, b) => b.score - a.score);
    return sorted.map((p, index) => ({
      playerId: p.id,
      nickname: p.nickname,
      score: p.score,
      rank: index + 1
    }));
  }
}
