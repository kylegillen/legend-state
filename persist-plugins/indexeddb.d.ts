import type { Change, ObservablePersistenceConfig, ObservablePersistLocal, PersistMetadata, PersistOptionsLocal } from '@legendapp/state';
export declare class ObservablePersistIndexedDB implements ObservablePersistLocal {
    private tableData;
    private tableMetadata;
    private tablesAdjusted;
    private db;
    private isSaveTaskQueued;
    private pendingSaves;
    private promisesQueued;
    constructor();
    initialize(config: ObservablePersistenceConfig['localOptions']): Promise<void>;
    loadTable(table: string, config: PersistOptionsLocal): void | Promise<void>;
    getTable(table: string, config: PersistOptionsLocal): any;
    getMetadata(table: string, config: PersistOptionsLocal): any;
    setMetadata(table: string, metadata: PersistMetadata, config: PersistOptionsLocal): Promise<IDBRequest<IDBValidKey>>;
    deleteMetadata(table: string, config: PersistOptionsLocal): Promise<void>;
    set(table: string, changes: Change[], config: PersistOptionsLocal): Promise<void>;
    private doSave;
    deleteTable(table: string, config: PersistOptionsLocal): Promise<void>;
    private getMetadataTableName;
    private initTable;
    private transactionStore;
    private _setItem;
    private _setTable;
}
