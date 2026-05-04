// Verifies StorageService URL helpers; storage SDK calls are exercised via integration tests.
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  function build(): StorageService {
    const config = {
      get: (key: string) =>
        ({
          FIREBASE_PROJECT_ID: 'proj',
          FIREBASE_CLIENT_EMAIL: 'svc@example.com',
          FIREBASE_PRIVATE_KEY:
            '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
          FIREBASE_STORAGE_BUCKET: 'gs://scholar-xp-test.firebasestorage.app',
        })[key],
    } as unknown as ConfigService;
    const service = new StorageService(config);
    service.onModuleInit();
    return service;
  }

  it('builds a public URL from the bucket name and encodes path segments', () => {
    const service = build();
    expect(service.publicUrl('profile-pictures/42/abc def.png')).toBe(
      'https://storage.googleapis.com/scholar-xp-test.firebasestorage.app/profile-pictures/42/abc%20def.png',
    );
  });

  it('recognizes URLs that point at our own bucket', () => {
    const service = build();
    expect(
      service.isOwnedUrl(
        'https://storage.googleapis.com/scholar-xp-test.firebasestorage.app/profile-pictures/42/x.png',
      ),
    ).toBe(true);
    expect(
      service.isOwnedUrl(
        'https://lh3.googleusercontent.com/a/some-google-avatar',
      ),
    ).toBe(false);
  });

  it('extracts the object path from an owned URL and decodes segments', () => {
    const service = build();
    expect(
      service.pathFromUrl(
        'https://storage.googleapis.com/scholar-xp-test.firebasestorage.app/profile-pictures/42/abc%20def.png',
      ),
    ).toBe('profile-pictures/42/abc def.png');
    expect(
      service.pathFromUrl(
        'https://lh3.googleusercontent.com/a/some-google-avatar',
      ),
    ).toBeNull();
  });
});
