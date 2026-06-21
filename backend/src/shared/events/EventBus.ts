// src/shared/events/EventBus.ts

import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class EventBus {
  private readonly subject = new Subject<any>();

  publish(event: any) {
    this.subject.next(event);
  }

  get$() {
    return this.subject.asObservable();
  }
}
