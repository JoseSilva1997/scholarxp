// Verifies practice question context counts eligible core questions and tracks the final question for remainder XP.
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';
import { ExpQuestionContextService } from './exp-question-context.service';

describe('ExpQuestionContextService', () => {
  let prisma: PrismaMock;
  let service: ExpQuestionContextService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ExpQuestionContextService(prisma);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns total eligible questions and the last eligible id', async () => {
    prisma.questionUnit.findMany.mockResolvedValue([
      { id: 10 },
      { id: 12 },
    ] as never);

    const result = await service.getPracticeQuestionContext(5);

    expect(prisma.questionUnit.findMany).toHaveBeenCalledWith({
      where: {
        moduleUnitId: 5,
        isArchived: false,
        contents: {
          some: {
            isCore: true,
            isArchived: false,
          },
        },
      },
      orderBy: [{ questionGroupId: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    expect(result).toEqual({ totalQuestions: 2, lastQuestionId: 12 });
  });

  it('returns null lastQuestionId when no eligible questions exist and can use a transaction client', async () => {
    const tx = createPrismaMock();
    tx.questionUnit.findMany.mockResolvedValue([] as never);

    const result = await service.getPracticeQuestionContext(5, tx);

    expect(prisma.questionUnit.findMany).not.toHaveBeenCalled();
    expect(tx.questionUnit.findMany).toHaveBeenCalled();
    expect(result).toEqual({ totalQuestions: 0, lastQuestionId: null });
  });
});
