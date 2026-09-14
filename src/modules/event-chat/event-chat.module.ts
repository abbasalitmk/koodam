import { Module } from '@nestjs/common';
import { EventChatController } from './event-chat.controller';
import { EventChatService } from './event-chat.service';
import { MessagesModule } from '../messages/messages.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule, MessagesModule],
  controllers: [EventChatController],
  providers: [EventChatService],
  exports: [EventChatService],
})
export class EventChatModule {}
