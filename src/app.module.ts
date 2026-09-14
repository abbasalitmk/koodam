import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import configuration from './config/configuration';
import { validateEnv } from './config/validation';
import { DatabaseModule } from './database/database.module';

import { AllExceptionsFilter } from './common/filters';
import { LoggingInterceptor, TransformResponseInterceptor } from './common/interceptors';
import { JwtAuthGuard, RolesGuard } from './common/guards';
import { AppController } from './app.controller';

import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { BlocksModule } from './modules/blocks/blocks.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { UsersModule } from './modules/users/users.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { LocationsModule } from './modules/locations/locations.module';
import { EventsModule } from './modules/events/events.module';
import { EventAttendeesModule } from './modules/event-attendees/event-attendees.module';
import { VouchesModule } from './modules/vouches/vouches.module';
import { LoveRequestsModule } from './modules/love-requests/love-requests.module';
import { ConnectionsModule } from './modules/connections/connections.module';
import { DatingModule } from './modules/dating/dating.module';
import { MessagesModule } from './modules/messages/messages.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { EventChatModule } from './modules/event-chat/event-chat.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SearchModule } from './modules/search/search.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { FeaturedEventsModule } from './modules/featured-events/featured-events.module';
import { MediaModule } from './modules/media/media.module';
import { ReportsModule } from './modules/reports/reports.module';
import { VerificationModule } from './modules/verification/verification.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),

    ScheduleModule.forRoot(),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get<number>('throttle.ttl', 60) * 1000,
            limit: config.get<number>('throttle.limit', 120),
          },
        ],
      }),
    }),

    DatabaseModule,
    BlocksModule,
    PrivacyModule,
    AuthModule,
    HealthModule,
    UsersModule,
    ProfilesModule,
    LocationsModule,
    EventsModule,
    EventAttendeesModule,
    VouchesModule,
    LoveRequestsModule,
    ConnectionsModule,
    DatingModule,
    MessagesModule,
    RealtimeModule,
    EventChatModule,
    NotificationsModule,
    SearchModule,
    RecommendationsModule,
    PaymentsModule,
    FeaturedEventsModule,
    MediaModule,
    ReportsModule,
    VerificationModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
