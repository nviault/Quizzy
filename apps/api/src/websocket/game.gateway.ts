import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { StoreService } from '../store/store.service';
import { GamesService } from '../games/games.service';
import { EventType } from '@kahoot/events';
import { GameStatus } from '@kahoot/types';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*'
  }
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly store: StoreService,
    private readonly gamesService: GamesService
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(@MessageBody() data: { gameId: string }, @ConnectedSocket() client: Socket) {
    client.join(data.gameId);
    return { status: 'joined', gameId: data.gameId };
  }

  @SubscribeMessage('host_start_game')
  handleHostStartGame(@MessageBody() data: { gameId: string }) {
    const game = this.gamesService.startGame(data.gameId);
    const quiz = this.store.getQuiz(game.quizId)!;
    const currentQ = quiz.questions[game.currentQuestionIndex];

    const sequence = this.store.getNextSequence(game.id);
    const serverTime = Date.now();
    const deadline = serverTime + currentQ.durationMs;

    this.server.to(game.id).emit('event', {
      type: EventType.GAME_STARTED,
      gameId: game.id,
      sequence,
      serverTime,
      quizTitle: quiz.title,
      totalQuestions: quiz.questions.length
    });

    this.server.to(game.id).emit('event', {
      type: EventType.QUESTION_STARTED,
      gameId: game.id,
      sequence: this.store.getNextSequence(game.id),
      serverTime,
      questionIndex: game.currentQuestionIndex,
      totalQuestions: quiz.questions.length,
      questionId: currentQ.id,
      text: currentQ.text,
      durationMs: currentQ.durationMs,
      answers: currentQ.answers,
      mediaUrl: currentQ.mediaUrl,
      deadline
    });
  }

  @SubscribeMessage('host_next_question')
  handleHostNextQuestion(@MessageBody() data: { gameId: string }) {
    const game = this.gamesService.nextQuestion(data.gameId);
    const quiz = this.store.getQuiz(game.quizId)!;

    if (game.status === GameStatus.FINISHED) {
      const finalLeaderboard = this.store.getLeaderboard(game.id);
      this.server.to(game.id).emit('event', {
        type: EventType.GAME_FINISHED,
        gameId: game.id,
        sequence: this.store.getNextSequence(game.id),
        serverTime: Date.now(),
        finalLeaderboard
      });
      return;
    }

    const currentQ = quiz.questions[game.currentQuestionIndex];
    const serverTime = Date.now();
    const deadline = serverTime + currentQ.durationMs;

    this.server.to(game.id).emit('event', {
      type: EventType.QUESTION_STARTED,
      gameId: game.id,
      sequence: this.store.getNextSequence(game.id),
      serverTime,
      questionIndex: game.currentQuestionIndex,
      totalQuestions: quiz.questions.length,
      questionId: currentQ.id,
      text: currentQ.text,
      durationMs: currentQ.durationMs,
      answers: currentQ.answers,
      mediaUrl: currentQ.mediaUrl,
      deadline
    });
  }

  @SubscribeMessage('host_end_question')
  handleHostEndQuestion(@MessageBody() data: { gameId: string }) {
    const game = this.gamesService.getGame(data.gameId);
    const quiz = this.store.getQuiz(game.quizId)!;
    const currentQ = quiz.questions[game.currentQuestionIndex];

    game.status = GameStatus.QUESTION_ENDED;
    this.store.saveGame(game);

    const responses = this.store.getQuestionResponses(game.id, currentQ.id);
    const answerCounts: Record<string, number> = {};
    currentQ.answers.forEach(a => { answerCounts[a.id] = 0; });
    responses.forEach(r => {
      answerCounts[r.answerId] = (answerCounts[r.answerId] || 0) + 1;
    });

    const leaderboard = this.store.getLeaderboard(game.id);

    this.server.to(game.id).emit('event', {
      type: EventType.QUESTION_ENDED,
      gameId: game.id,
      sequence: this.store.getNextSequence(game.id),
      serverTime: Date.now(),
      questionIndex: game.currentQuestionIndex,
      correctAnswerId: currentQ.correctAnswerId,
      answerCounts
    });

    this.server.to(game.id).emit('event', {
      type: EventType.LEADERBOARD_UPDATED,
      gameId: game.id,
      sequence: this.store.getNextSequence(game.id),
      serverTime: Date.now(),
      leaderboard
    });
  }

  @SubscribeMessage('player_submit_answer')
  handlePlayerSubmitAnswer(
    @MessageBody() data: { gameId: string; playerId: string; questionId: string; answerId: string },
    @ConnectedSocket() client: Socket
  ) {
    try {
      const result = this.gamesService.submitAnswer(
        data.gameId,
        data.playerId,
        data.questionId,
        data.answerId
      );

      client.emit('answer_result', result);

      this.server.to(data.gameId).emit('event', {
        type: EventType.ANSWER_SUBMITTED,
        gameId: data.gameId,
        sequence: this.store.getNextSequence(data.gameId),
        serverTime: Date.now(),
        playerId: data.playerId,
        questionId: data.questionId
      });
    } catch (err) {
      client.emit('error', { message: (err as Error).message });
    }
  }

  @SubscribeMessage('player_join')
  handlePlayerJoin(
    @MessageBody() data: { pin: string; nickname: string },
    @ConnectedSocket() client: Socket
  ) {
    try {
      const { game, player } = this.gamesService.joinGame(data.pin, data.nickname);
      client.join(game.id);

      const players = this.store.getPlayers(game.id);

      this.server.to(game.id).emit('event', {
        type: EventType.PLAYER_JOINED,
        gameId: game.id,
        sequence: this.store.getNextSequence(game.id),
        serverTime: Date.now(),
        player: { id: player.id, nickname: player.nickname, score: player.score },
        playerCount: players.length
      });

      return { success: true, gameId: game.id, playerId: player.id, player };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }
}
