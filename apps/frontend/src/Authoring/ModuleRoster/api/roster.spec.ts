// Verifies roster API helpers preserve module-scoped analytics routes and query strings.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getLessonDrilldown,
  getRosterLessons,
  getRosterStudentDetail,
  getRosterStudents,
  getRosterSummary,
  removeRosterStudent,
} from '@/Authoring/ModuleRoster/api/roster';

const clientMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({
  apiFetch: clientMocks.apiFetch,
}));

describe('roster api', () => {
  beforeEach(() => {
    clientMocks.apiFetch.mockReset();
    clientMocks.apiFetch.mockResolvedValue(undefined);
  });

  it('fetches roster summary', async () => {
    await getRosterSummary(12);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/module/12/roster/summary', {
      method: 'GET',
    });
  });

  it('fetches students with optional filter, sort, and search params', async () => {
    await getRosterStudents(12, {
      filter: 'at_risk',
      sortBy: 'last_activity',
      sortDirection: 'desc',
      search: 'ada',
    });

    expect(clientMocks.apiFetch).toHaveBeenCalledWith(
      '/module/12/roster/students?filter=at_risk&sortBy=last_activity&sortDirection=desc&search=ada',
      { method: 'GET' },
    );
  });

  it('fetches students without a query string when options are omitted', async () => {
    await getRosterStudents(12);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/module/12/roster/students', {
      method: 'GET',
    });
  });

  it('fetches lessons with optional sort params', async () => {
    await getRosterLessons(12, { sortBy: 'completion_rate', sortDirection: 'asc' });

    expect(clientMocks.apiFetch).toHaveBeenCalledWith(
      '/module/12/roster/lessons?sortBy=completion_rate&sortDirection=asc',
      { method: 'GET' },
    );
  });

  it('fetches student detail, removes a student, and fetches lesson drilldown', async () => {
    await getRosterStudentDetail(12, 34);
    await removeRosterStudent(12, 34);
    await getLessonDrilldown(12, 56);

    expect(clientMocks.apiFetch).toHaveBeenNthCalledWith(
      1,
      '/module/12/roster/students/34',
      { method: 'GET' },
    );
    expect(clientMocks.apiFetch).toHaveBeenNthCalledWith(
      2,
      '/module/12/roster/students/34',
      { method: 'DELETE' },
    );
    expect(clientMocks.apiFetch).toHaveBeenNthCalledWith(
      3,
      '/module/12/roster/lessons/56',
      { method: 'GET' },
    );
  });
});
