import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrivacyService } from './privacy.service';
import { UpdatePrivacyDto } from './dto/privacy.dto';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Privacy')
@ApiBearerAuth()
@Controller({ path: 'privacy', version: '1' })
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Read the current user’s privacy settings' })
  get(@CurrentUser('id') userId: string) {
    return this.privacy.get(userId);
  }

  @Put('settings')
  @ApiOperation({
    summary: 'Update privacy settings, including Private Mode',
  })
  update(@CurrentUser('id') userId: string, @Body() dto: UpdatePrivacyDto) {
    return this.privacy.update(userId, dto);
  }
}
