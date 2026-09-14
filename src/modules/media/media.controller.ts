import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MediaService, PresignUploadDto } from './media.service';
import { CurrentUser, ThrottleWrite } from '../../common/decorators';
import { ApiErrorResponse } from '../../common/dto/api-response.dto';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

class RequestUploadDto {
  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @IsIn(['photos', 'events', 'chat'])
  folder!: 'photos' | 'events' | 'chat';
}

@ApiTags('Media')
@ApiBearerAuth()
@ApiResponse({ status: 400, type: ApiErrorResponse })
@Controller({ path: 'media', version: '1' })
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @ThrottleWrite()
  @Post('presign')
  @ApiOperation({ summary: 'Obtain secure presigned upload URL for photo or cover image' })
  requestPresignedUrl(@CurrentUser('id') userId: string, @Body() dto: RequestUploadDto) {
    return this.media.generatePresignedUpload(userId, dto);
  }
}
