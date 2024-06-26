import type { Change, ObservablePersistLocal, PersistMetadata } from '@legendapp/state';
declare class ObservablePersistLocalStorageBase implements ObservablePersistLocal {
    private data;
    private storage;
    constructor(storage: Storage | undefined);
    getTable(table: string): any;
    getMetadata(table: string): PersistMetadata;
    set(table: string, changes: Change[]): void;
    setMetadata(table: string, metadata: PersistMetadata): void;
    deleteTable(table: string): undefined;
    deleteMetadata(table: string): void;
    private setValue;
    private save;
}
export declare class ObservablePersistLocalStorage extends ObservablePersistLocalStorageBase {
    constructor();
}
export declare class ObservablePersistSessionStorage extends ObservablePersistLocalStorageBase {
    constructor();
}
export {};
