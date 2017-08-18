import { Observer } from 'rxjs/Observer';
import { TestMessageValue } from './message/TestMessageValue';

/**
 * An Observer records Observable values emitted in form of TestMessageValue
 *
 */
export interface MessageRecordObserverBase<T = string> extends Observer<T> {
  /**
   * Metadata of subscribed Observable, recorded value of next(), error(), complete() calls.
   */
  readonly messages: Readonly<Array<TestMessageValue<T>>>;
}