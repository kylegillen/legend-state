import { setAtPath, internal } from '@legendapp/state';

const MetadataSuffix = '__m';
const { safeParse, safeStringify } = internal;
class ObservablePersistLocalStorageBase {
    constructor(storage) {
        this.data = {};
        this.storage = storage;
    }
    getTable(table) {
        if (!this.storage)
            return undefined;
        if (this.data[table] === undefined) {
            try {
                const value = this.storage.getItem(table);
                this.data[table] = value ? safeParse(value) : undefined;
            }
            catch (_a) {
                console.error('[legend-state] ObservablePersistLocalStorage failed to parse', table);
            }
        }
        return this.data[table];
    }
    getMetadata(table) {
        return this.getTable(table + MetadataSuffix);
    }
    set(table, changes) {
        if (!this.data[table]) {
            this.data[table] = {};
        }
        for (let i = 0; i < changes.length; i++) {
            const { path, valueAtPath, pathTypes } = changes[i];
            this.data[table] = setAtPath(this.data[table], path, pathTypes, valueAtPath);
        }
        this.save(table);
    }
    setMetadata(table, metadata) {
        return this.setValue(table + MetadataSuffix, metadata);
    }
    deleteTable(table) {
        if (!this.storage)
            return undefined;
        delete this.data[table];
        this.storage.removeItem(table);
    }
    deleteMetadata(table) {
        this.deleteTable(table + MetadataSuffix);
    }
    // Private
    setValue(table, value) {
        this.data[table] = value;
        this.save(table);
    }
    save(table) {
        if (!this.storage)
            return undefined;
        const v = this.data[table];
        if (v !== undefined && v !== null) {
            this.storage.setItem(table, safeStringify(v));
        }
        else {
            this.storage.removeItem(table);
        }
    }
}
class ObservablePersistLocalStorage extends ObservablePersistLocalStorageBase {
    constructor() {
        super(typeof localStorage !== 'undefined' ? localStorage : undefined);
    }
}
class ObservablePersistSessionStorage extends ObservablePersistLocalStorageBase {
    constructor() {
        super(typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
    }
}

export { ObservablePersistLocalStorage, ObservablePersistSessionStorage };
//# sourceMappingURL=local-storage.mjs.map
