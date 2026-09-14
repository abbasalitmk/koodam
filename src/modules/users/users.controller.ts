import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AddPhotoDto, DeleteAccountDto, RegisterDeviceTokenDto, ReorderPhotosDto } from './dto/users.dto';
import { CurrentUser, Public, ThrottleWrite } from '../../common/decorators';
import { ApiErrorResponse } from '../../common/dto/api-response.dto';

@ApiTags('Users')
@ApiResponse({ status: 400, type: ApiErrorResponse })
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Public()
  @Get('../interests')
  @ApiOperation({ summary: 'Get list of active interest categories & tags' })
  listInterests() {
    return this.users.listInterests();
  }

  @ApiBearerAuth()
  @Get('me/interests')
  @ApiOperation({ summary: 'Get current user selected interests' })
  getMyInterests(@CurrentUser('id') userId: string) {
    return this.users.getMyInterests(userId);
  }

  @ApiBearerAuth()
  @ThrottleWrite()
  @Post('me/photos')
  @ApiOperation({ summary: 'Add a new profile photo (max 6)' })
  addPhoto(@CurrentUser('id') userId: string, @Body() dto: AddPhotoDto) {
    return this.users.addPhoto(userId, dto);
  }

  @ApiBearerAuth()
  @Delete('me/photos/:id')
  @ApiOperation({ summary: 'Delete a profile photo' })
  deletePhoto(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) photoId: string) {
    return this.users.deletePhoto(userId, photoId);
  }

  @ApiBearerAuth()
  @Put('me/photos/:id/primary')
  @ApiOperation({ summary: 'Set photo as primary display avatar' })
  setPrimaryPhoto(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) photoId: string) {
    return this.users.setPrimaryPhoto(userId, photoId);
  }

  @ApiBearerAuth()
  @Put('me/photos/reorder')
  @ApiOperation({ summary: 'Reorder profile photos' })
  reorderPhotos(@CurrentUser('id') userId: string, @Body() dto: ReorderPhotosDto) {
    return this.users.reorderPhotos(userId, dto);
  }

  @ApiBearerAuth()
  @Post('me/device-tokens')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register push notification device token (FCM/APNs)' })
  registerDeviceToken(@CurrentUser('id') userId: string, @Body() dto: RegisterDeviceTokenDto) {
    return this.users.registerDeviceToken(userId, dto);
  }

  @ApiBearerAuth()
  @Delete('me/device-tokens/:token')
  @ApiOperation({ summary: 'Unregister push notification device token' })
  unregisterDeviceToken(@CurrentUser('id') userId: string, @Param('token') token: string) {
    return this.users.unregisterDeviceToken(userId, token);
  }

  @ApiBearerAuth()
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request account deletion with data anonymization and privacy cascade' })
  deleteAccount(@CurrentUser('id') userId: string, @Body() dto: DeleteAccountDto) {
    return this.users.deleteAccount(userId, dto);
  }
}
