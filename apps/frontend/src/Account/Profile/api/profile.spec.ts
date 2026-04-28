// Verifies profile API helpers keep student and tutor aggregate endpoints stable.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getStudentProfile, getTutorProfile } from '@/Account/Profile/api/profile';

const clientMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({
  apiFetch: clientMocks.apiFetch,
}));

describe('profile api', () => {
  beforeEach(() => {
    clientMocks.apiFetch.mockReset();
    clientMocks.apiFetch.mockResolvedValue(undefined);
  });

  it('fetches the student profile aggregate', async () => {
    await getStudentProfile();

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/profile/student');
  });

  it('fetches the tutor profile aggregate', async () => {
    await getTutorProfile();

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/profile/tutor');
  });
});
