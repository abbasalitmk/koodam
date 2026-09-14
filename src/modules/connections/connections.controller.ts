import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConnectionsService } from './connections.service';
import { CreateConnectionDto } from './dto/connections.dto';
import { CurrentUser, ThrottleWrite } from '../../common/decorators';
import { ApiErrorResponse } from '../../common/dto/api-response.dto';

@ApiTags('Connections')
@ApiBearerAuth()
@ApiResponse({ status: 400, type: ApiErrorResponse })
@Controller({ path: 'connections', version: '1' })
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Get()
  @ApiOperation({ summary: 'List current user active connections (Connect Friends + Love matches)' })
  list(@CurrentUser('id') userId: string) {
    return this.connections.listConnections(userId);
  }

  @ThrottleWrite()
  @Post()
  @ApiOperation({ summary: 'Create connection handshake with another user' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateConnectionDto) {
    return this.connections.createConnection(userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove an active connection' })
  remove(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.connections.removeConnection(userId, id);
  }
}
