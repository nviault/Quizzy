import { Injectable, NotFoundException } from '@nestjs/common';
import { StoreService } from '../store/store.service';
import { Quiz } from '@kahoot/types';

@Injectable()
export class QuizzesService {
  constructor(private readonly store: StoreService) {}

  getAllQuizzes(): Quiz[] {
    return this.store.getAllQuizzes();
  }

  getQuizById(id: string): Quiz {
    const quiz = this.store.getQuiz(id);
    if (!quiz) {
      throw new NotFoundException(`Quiz with ID ${id} not found`);
    }
    return quiz;
  }

  createQuiz(quizData: Partial<Quiz>): Quiz {
    const newQuiz: Quiz = {
      id: `quiz-${Date.now()}`,
      ownerId: quizData.ownerId || 'host',
      title: quizData.title || 'Nouveau Quiz',
      description: quizData.description || '',
      visibility: quizData.visibility || 'PUBLIC',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questions: quizData.questions || []
    };
    return this.store.saveQuiz(newQuiz);
  }
}
