import { Module } from '@nestjs/common';
import { StoreService } from './store/store.service';
import { QuizzesService } from './quizzes/quizzes.service';
import { QuizzesController } from './quizzes/quizzes.controller';
import { GamesService } from './games/games.service';
import { GamesController } from './games/games.controller';
import { GameGateway } from './websocket/game.gateway';

@Module({
  imports: [],
  controllers: [QuizzesController, GamesController],
  providers: [StoreService, QuizzesService, GamesService, GameGateway]
})
export class AppModule {}
