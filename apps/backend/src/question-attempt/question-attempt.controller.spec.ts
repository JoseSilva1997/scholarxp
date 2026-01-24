import { runCrudControllerTests } from '../testing/test-helpers';
import { QuestionAttemptController } from './question-attempt.controller';
import { QuestionAttemptService } from './question-attempt.service';

runCrudControllerTests({
  name: 'QuestionAttemptController',
  controller: QuestionAttemptController,
  service: QuestionAttemptService,
  createDto: {
    userId: 1,
    questionVariantId: 2,
    isCorrect: true,
    score: 0.8,
    attemptedAt: '2024-01-01T00:00:00.000Z',
  },
  updateDto: {
    isCorrect: false,
    score: 0.6,
  },
});
