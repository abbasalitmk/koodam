import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ParseUUIDPipe } from '@nestjs/common';
import { BlocksService } from './blocks.service';
import { CurrentUser, ThrottleWrite } from '../../common/decorators';

export class BlockUserDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

@ApiTags('Blocks')
@ApiBearerAuth()
@Controller({ path: 'blocks', version: '1' })
export class BlocksController {
  constructor(private readonly blocks: BlocksService) {}

  @Get()
  @ApiOperation({ summary: 'List accounts the current user has blocked' })
  list(@CurrentUser('id') userId: string) {
    return this.blocks.list(userId);
  }

  @ThrottleWrite()
  @Post(':userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Block a user',
    description:
      'Removes the account from discovery, dating, the map and event attendee lists in both ' +
      'directions, cancels pending love requests and suspends any connection.',
  })
  block(
    @CurrentUser('id') blockerId: string,
    @Param('userId', ParseUUIDPipe) blockedId: string,
    @Body() dto: BlockUserDto,
  ) {
    return this.blocks.block(blockerId, blockedId, dto.reason);
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Unblock a user' })
  unblock(
    @CurrentUser('id') blockerId: string,
    @Param('userId', ParseUUIDPipe) blockedId: string,
  ) {
    return this.blocks.unblock(blockerId, blockedId);
  }
}
