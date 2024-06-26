import { ObserveEvent, ObserveEventCallback, Selector } from './observableInterfaces';
export interface ObserveOptions {
    immediate?: boolean;
}
export declare function observe<T>(run: (e: ObserveEvent<T>) => T | void, options?: ObserveOptions): () => void;
export declare function observe<T>(selector: Selector<T> | ((e: ObserveEvent<T>) => any), reaction?: (e: ObserveEventCallback<T>) => any, options?: ObserveOptions): () => void;
