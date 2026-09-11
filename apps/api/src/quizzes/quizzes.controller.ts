import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { QuizzesService } from './quizzes.service';
import { Quiz } from '@kahoot/types';

@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Get()
  getAll(): Quiz[] {
    return this.quizzesService.getAllQuizzes();
  }

  @Get(':id')
  getById(@Param('id') id: string): Quiz {
    return this.quizzesService.getQuizById(id);
  }

  @Post()
  create(@Body() body: Partial<Quiz>): Quiz {
    return this.quizzesService.createQuiz(body);
  }
}
