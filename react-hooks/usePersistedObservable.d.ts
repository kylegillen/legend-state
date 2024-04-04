import { Observable, PersistOptions, WithPersistState } from '@legendapp/state';
import type { WithoutState } from '../persist/persistObservable';
/**
 * A React hook that creates a new observable and can optionally listen or persist its state.
 *
 * @param initialValue The initial value of the observable or a function that returns the initial value
 * @param options Persistence options for the observable
 *
 * @see https://www.legendapp.com/dev/state/react/#useObservable
 */
export declare function usePersistedObservable<T extends WithoutState>(initialValue: T | (() => T) | (() => Promise<T>), options: PersistOptions<T>): Observable<WithPersistState & T>;
