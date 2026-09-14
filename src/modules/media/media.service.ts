import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

export class PresignUploadDto {
  contentType!: string;
  folder!: 'photos' | 'events' | 'chat';
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

@Injectable()
export class MediaService {
  constructor(private readonly config: ConfigService) {}

  generatePresignedUpload(userId: string, dto: PresignUploadDto) {
    if (!ALLOWED_MIME_TYPES.includes(dto.contentType.toLowerCase())) {
      throw new BadRequestException('Only JPEG, PNG and WebP images are allowed.');
    }

    const ext = dto.contentType.split('/')[1] ?? 'jpg';
    const filename = `${randomBytes(16).toString('hex')}.${ext}`;
    const storageKey = `${dto.folder}/${userId}/${filename}`;

    const baseUrl = this.config.get<string>('storage.publicUrl') || 'http://localhost:3000/static';
    const fileUrl = `${baseUrl}/${storageKey}`;

    // For local mock storage, direct upload endpoint or presigned S3 URL
    const uploadUrl = `${baseUrl}/upload?key=${encodeURIComponent(storageKey)}`;

    return {
      uploadUrl,
      fileUrl,
      storageKey,
      expiresInSeconds: 900,
    };
  }
}
