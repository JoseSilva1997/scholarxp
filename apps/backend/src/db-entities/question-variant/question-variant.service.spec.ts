import { runCrudServiceTests } from '../../test/test-helpers';
import { QuestionVariantService } from './question-variant.service';

runCrudServiceTests({
  name: 'QuestionVariantService',
  service: QuestionVariantService,
  modelName: 'questionVariant',
  entityLabel: 'QuestionVariant',
  createDto: {
    questionUnitId: 1,
    contentId: 2,
    variantLabel: 'A',
  },
  updateDto: {
    variantLabel: 'B',
  },
});
