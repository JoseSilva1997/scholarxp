import { runCrudControllerTests } from '../../../test/test-helpers';
import { QuestionVariantController } from './question-variant.controller';
import { QuestionVariantService } from './question-variant.service';

runCrudControllerTests({
  name: 'QuestionVariantController',
  controller: QuestionVariantController,
  service: QuestionVariantService,
  createDto: {
    questionUnitId: 1,
    contentId: 2,
    variantLabel: 'A',
  },
  updateDto: {
    variantLabel: 'B',
  },
});
