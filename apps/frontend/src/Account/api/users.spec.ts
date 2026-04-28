// Verifies user API helpers keep route and payload contracts stable for profile writes.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  removeProfilePicture,
  updateName,
  updateTimezone,
  updateUserRole,
  uploadProfilePicture,
} from '@/Account/api/users';
import { PROFILE_PICTURE_UPLOAD_FIELD } from '@scholarxp/api-contracts';

const clientMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({
  apiFetch: clientMocks.apiFetch,
}));

describe('users api', () => {
  beforeEach(() => {
    clientMocks.apiFetch.mockReset();
    clientMocks.apiFetch.mockResolvedValue(undefined);
  });

  it('updates user role with PATCH /users/:id/role and globalRole payload', async () => {
    await updateUserRole(55, 'admin');

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/users/55/role', {
      method: 'PATCH',
      body: JSON.stringify({ globalRole: 'admin' }),
    });
  });

  it('updates names with PATCH /users/:id/name and trimmed payload passed by caller', async () => {
    await updateName(55, 'Ada', 'Lovelace');

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/users/55/name', {
      method: 'PATCH',
      body: JSON.stringify({ firstName: 'Ada', lastName: 'Lovelace' }),
    });
  });

  it('updates timezone with PATCH /users/:id/timezone', async () => {
    await updateTimezone(55, 'Europe/London');

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/users/55/timezone', {
      method: 'PATCH',
      body: JSON.stringify({ timezone: 'Europe/London' }),
    });
  });

  it('uploads a profile picture as multipart form data', async () => {
    const file = new Blob(['avatar'], { type: 'image/png' });

    await uploadProfilePicture(55, file);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/users/55/profile-picture', {
      method: 'PUT',
      body: expect.any(FormData),
    });
    const body = clientMocks.apiFetch.mock.calls[0][1].body as FormData;
    expect(body.get(PROFILE_PICTURE_UPLOAD_FIELD)).toBeInstanceOf(File);
    expect((body.get(PROFILE_PICTURE_UPLOAD_FIELD) as File).name).toBe('avatar.png');
  });

  it('removes profile picture with DELETE /users/:id/profile-picture', async () => {
    await removeProfilePicture(55);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/users/55/profile-picture', {
      method: 'DELETE',
    });
  });
});
