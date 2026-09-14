import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LocationMode } from '@prisma/client';
import { ProfilesService } from './profiles.service';
import {
  CreateProfileDto,
  SetExploringLocationDto,
  SetInterestsDto,
  UpdateLocationDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
} from './dto/profile.dto';
import { MyProfileDto, PublicProfileDto } from './dto/profile-response.dto';
import { CurrentUser, ThrottleWrite } from '../../common/decorators';
import { ApiErrorResponse } from '../../common/dto/api-response.dto';

@ApiTags('Profiles')
@ApiBearerAuth()
@ApiResponse({ status: 400, type: ApiErrorResponse })
@Controller({ path: 'profiles', version: '1' })
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile with complete details' })
  @ApiResponse({ status: 200, type: MyProfileDto })
  getMine(@CurrentUser('id') userId: string) {
    return this.profiles.getMine(userId);
  }

  @Post('me')
  @ApiOperation({ summary: 'Create initial profile during onboarding wizard' })
  @ApiResponse({ status: 201, type: MyProfileDto })
  createMine(@CurrentUser('id') userId: string, @Body() dto: CreateProfileDto) {
    return this.profiles.createOrUpdateMine(userId, dto);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Partially update current user profile' })
  @ApiResponse({ status: 200, type: MyProfileDto })
  updateMine(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.profiles.updateMine(userId, dto);
  }

  @ThrottleWrite()
  @Put('me/location')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update raw device GPS location (obfuscated before storage)' })
  updateLocation(@CurrentUser('id') userId: string, @Body() dto: UpdateLocationDto) {
    return this.profiles.updateLocation(userId, dto);
  }

  @Put('me/exploring-location')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set exploring location (e.g. Dubai resident exploring Kochi)' })
  setExploringLocation(@CurrentUser('id') userId: string, @Body() dto: SetExploringLocationDto) {
    return this.profiles.setExploringLocation(userId, dto.locationId);
  }

  @Delete('me/exploring-location')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear exploring location and reset to Near Me' })
  clearExploringLocation(@CurrentUser('id') userId: string) {
    return this.profiles.clearExploringLocation(userId);
  }

  @Put('me/location-mode/:mode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set location discovery mode (NEAR_ME, CHOOSE_LOCATION, KERALA)' })
  setLocationMode(@CurrentUser('id') userId: string, @Param('mode') mode: LocationMode) {
    return this.profiles.setLocationMode(userId, mode);
  }

  @Get('me/preferences')
  @ApiOperation({ summary: 'Get dating & discovery preferences' })
  getPreferences(@CurrentUser('id') userId: string) {
    return this.profiles.getPreferences(userId);
  }

  @Put('me/preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update dating & discovery preferences' })
  updatePreferences(@CurrentUser('id') userId: string, @Body() dto: UpdatePreferencesDto) {
    return this.profiles.updatePreferences(userId, dto);
  }

  @Put('me/interests')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update selected interest tags' })
  setInterests(@CurrentUser('id') userId: string, @Body() dto: SetInterestsDto) {
    return this.profiles.setInterests(userId, dto);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get public profile of another user with privacy controls applied' })
  @ApiResponse({ status: 200, type: PublicProfileDto })
  getPublic(
    @CurrentUser('id') viewerId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.profiles.getPublic(viewerId, targetUserId);
  }
}
