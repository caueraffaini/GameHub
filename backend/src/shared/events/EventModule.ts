// src/shared/events/EventModule.ts

import { Module, Global } from '@nestjs/common';
import { EventBus } from './EventBus';

@Global()
@Module({
  providers: [EventBus],
  exports: [EventBus],
})
export class EventModule {}
