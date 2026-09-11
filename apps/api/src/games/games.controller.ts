import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { GamesService } from './games.service';

@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Post()
  createGame(@Body() body: { quizId: string; hostId?: string }) {
    return this.gamesService.createGame(body.quizId, body.hostId);
  }

  @Get(':id')
  getGame(@Param('id') id: string) {
    return this.gamesService.getGame(id);
  }

  @Post('join')
  joinGame(@Body() body: { pin: string; nickname: string }) {
    return this.gamesService.joinGame(body.pin, body.nickname);
  }
}
