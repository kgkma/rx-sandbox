import { Notification } from 'rxjs/Notification';
import { Observable } from 'rxjs/Observable';
import { VirtualTimeScheduler } from 'rxjs/scheduler/VirtualTimeScheduler';
import { VirtualAction } from 'rxjs/scheduler/VirtualTimeScheduler';
import { Subscription } from 'rxjs/Subscription';
import { ColdObservable } from 'rxjs/testing/ColdObservable';
import { HotObservable } from 'rxjs/testing/HotObservable';
import { parseObservableMarble } from '../marbles/parseObservableMarble';
import { parseSubscriptionMarble } from '../marbles/parseSubscriptionMarble';
import { SubscriptionMarbleToken } from '../marbles/SubscriptionMarbleToken';
import { TestMessage } from '../message/TestMessage';
import { TestMessageValue } from '../message/TestMessageValue';

class TestScheduler extends VirtualTimeScheduler {
  private readonly coldObservables: Array<ColdObservable<any>> = [];
  private readonly hotObservables: Array<HotObservable<any>> = [];

  constructor(private readonly autoFlush = false, private readonly frameTimeFactor = 1) {
    super(VirtualAction, Number.POSITIVE_INFINITY);
  }

  public getMarbles<T = string>(observable: Observable<T>, unsubscriptionMarbles: string | null = null) {
    if (this.autoFlush) {
      throw new Error('not implemented');
    }

    const { unsubscribedFrame } = parseSubscriptionMarble(unsubscriptionMarbles);
    const observableMetadata: Array<TestMessage<T | Array<TestMessage<T>>>> = [];
    const pushMetadata = (notification: Notification<T | Array<TestMessage<T>>>) =>
      observableMetadata.push(new TestMessageValue<T | Array<TestMessage<T>>>(this.frame, notification));

    let subscription: Subscription | null = null;

    this.schedule(() => {
      subscription = observable.subscribe(
        (value: T) =>
          pushMetadata(
            Notification.createNext(
              value instanceof Observable ? this.materializeInnerObservable<T>(value, this.frame) : value
            )
          ),
        (err: any) => pushMetadata(Notification.createError(err)),
        () => pushMetadata(Notification.createComplete())
      );
    }, 0);

    if (unsubscribedFrame !== Number.POSITIVE_INFINITY && !!subscription) {
      this.schedule(() => subscription!.unsubscribe(), unsubscribedFrame);
    }

    return observableMetadata;
  }

  public advanceBy(_frameTime: number): void {
    throw new Error('not implemented');
  }

  public advanceTo(_frameTime: number): void {
    throw new Error('not implemented');
  }

  public createColdObservable<T = string>(marble: string, value?: { [key: string]: T }, error?: any): Observable<T>;
  public createColdObservable<T = string>(message: Array<TestMessage<T>>): Observable<T>;
  public createColdObservable<T = string>(...args: Array<any>): Observable<T> {
    const [marbleValue, value, error] = args;

    if (typeof marbleValue === 'string' && marbleValue.indexOf(SubscriptionMarbleToken.SUBSCRIBE) !== -1) {
      throw new Error(`Cold observable cannot have subscription offset ${SubscriptionMarbleToken.SUBSCRIBE}`);
    }

    const messages = Array.isArray(marbleValue)
      ? marbleValue
      : parseObservableMarble(marbleValue, value, error, false, this.frameTimeFactor);
    const observable = new ColdObservable<T>(messages, this);
    this.coldObservables.push(observable);
    return observable;
  }

  public createHotObservable<T = string>(marble: string, value?: { [key: string]: T }, error?: any): Observable<T>;
  public createHotObservable<T = string>(message: Array<TestMessage<T>>): Observable<T>;
  public createHotObservable<T = string>(...args: Array<any>): Observable<T> {
    const [marbleValue, value, error] = args;

    const messages = Array.isArray(marbleValue)
      ? marbleValue
      : parseObservableMarble(marbleValue, value, error, false, this.frameTimeFactor);
    const subject = new HotObservable<T>(messages, this);
    this.hotObservables.push(subject);
    return subject;
  }

  private materializeInnerObservable<T>(observable: Observable<any>, outerFrame: number): Array<TestMessage<T>> {
    const innerObservableMetadata: Array<TestMessage<T>> = [];
    const pushMetaData = (notification: Notification<T>) =>
      innerObservableMetadata.push(new TestMessageValue<T>(this.frame - outerFrame, notification));

    observable.subscribe(
      value => pushMetaData(Notification.createNext(value)),
      err => pushMetaData(Notification.createError(err)),
      () => pushMetaData(Notification.createComplete())
    );

    return innerObservableMetadata;
  }
}

export { TestScheduler };