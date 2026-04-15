// Wraps Google Cloud Storage (Firebase Storage bucket) for user-generated assets like profile pictures.
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bucket, Storage } from '@google-cloud/storage';

export interface UploadResult {
  // Storage object path (without bucket); persisted indirectly so we can later delete owned objects.
  path: string;
  // Public-read URL safe to store on the user record and render directly from the browser.
  publicUrl: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private bucket!: Bucket;
  private bucketName!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const projectId = this.requireEnv('FIREBASE_PROJECT_ID');
    const clientEmail = this.requireEnv('FIREBASE_CLIENT_EMAIL');
    // Env-stored private keys keep escaped newlines literal; convert back so the JWT signer parses PEM correctly.
    const privateKey = this.requireEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');
    this.bucketName = normalizeBucketName(this.requireEnv('FIREBASE_STORAGE_BUCKET'));

    const storage = new Storage({
      projectId,
      credentials: { client_email: clientEmail, private_key: privateKey },
    });
    this.bucket = storage.bucket(this.bucketName);
  }

  async upload(
    objectPath: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<UploadResult> {
    const file = this.bucket.file(objectPath);
    try {
      await file.save(buffer, {
        contentType,
        resumable: false,
        // Long max-age relies on path-level uniqueness (UUID per upload) so replaces never serve stale bytes.
        metadata: { cacheControl: 'public, max-age=31536000, immutable' },
      });
      // Public-read ACL is acceptable for avatars; bucket-level uniform access must allow it.
      await file.makePublic();
    } catch (err) {
      this.logger.error('Failed to upload object', err as Error);
      throw new InternalServerErrorException('Failed to upload file');
    }
    return { path: objectPath, publicUrl: this.publicUrl(objectPath) };
  }

  async delete(objectPath: string): Promise<void> {
    try {
      await this.bucket.file(objectPath).delete({ ignoreNotFound: true });
    } catch (err) {
      // Old-blob cleanup must never block the user-visible flow; log and swallow so updates still succeed.
      this.logger.warn(`Failed to delete object ${objectPath}: ${(err as Error).message}`);
    }
  }

  publicUrl(objectPath: string): string {
    return `https://storage.googleapis.com/${this.bucketName}/${encodeObjectPath(objectPath)}`;
  }

  // Lets owning services check whether a stored URL points at our bucket before scheduling deletion.
  isOwnedUrl(url: string): boolean {
    const prefix = `https://storage.googleapis.com/${this.bucketName}/`;
    return url.startsWith(prefix);
  }

  pathFromUrl(url: string): string | null {
    const prefix = `https://storage.googleapis.com/${this.bucketName}/`;
    if (!url.startsWith(prefix)) return null;
    return decodeURIComponent(url.slice(prefix.length));
  }

  private requireEnv(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new InternalServerErrorException(`Missing env var: ${key}`);
    }
    return value;
  }
}

// Firebase exposes buckets as gs://<name>; the GCS SDK wants the bare name.
function normalizeBucketName(raw: string): string {
  return raw.replace(/^gs:\/\//, '').replace(/\/$/, '');
}

// Path segments may contain "/" — encode each segment so signed-style URLs round-trip cleanly.
function encodeObjectPath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}
