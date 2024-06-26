import { setAtPath, internal } from '@legendapp/state';
import { MMKV } from 'react-native-mmkv';

const symbolDefault = Symbol();
const MetadataSuffix = '__m';
const { safeParse, safeStringify } = internal;
class ObservablePersistMMKV {
    constructor() {
        this.data = {};
        this.storages = new Map([
            [
                symbolDefault,
                new MMKV({
                    id: `obsPersist`,
                }),
            ],
        ]);
    }
    // Gets
    getTable(table, config) {
        const storage = this.getStorage(config);
        if (this.data[table] === undefined) {
            try {
                const value = storage.getString(table);
                this.data[table] = value ? safeParse(value) : undefined;
            }
            catch (_a) {
                console.error('[legend-state] MMKV failed to parse', table);
            }
        }
        return this.data[table];
    }
    getMetadata(table, config) {
        return this.getTable(table + MetadataSuffix, config);
    }
    // Sets
    set(table, changes, config) {
        if (!this.data[table]) {
            this.data[table] = {};
        }
        for (let i = 0; i < changes.length; i++) {
            const { path, valueAtPath, pathTypes } = changes[i];
            this.data[table] = setAtPath(this.data[table], path, pathTypes, valueAtPath);
        }
        this.save(table, config);
    }
    setMetadata(table, metadata, config) {
        return this.setValue(table + MetadataSuffix, metadata, config);
    }
    deleteTable(table, config) {
        const storage = this.getStorage(config);
        delete this.data[table];
        storage.delete(table);
    }
    deleteMetadata(table, config) {
        this.deleteTable(table + MetadataSuffix, config);
    }
    // Private
    getStorage(config) {
        const { mmkv } = config;
        if (mmkv) {
            const key = JSON.stringify(mmkv);
            let storage = this.storages.get(key);
            if (!storage) {
                storage = new MMKV(mmkv);
                this.storages.set(key, storage);
            }
            return storage;
        }
        else {
            return this.storages.get(symbolDefault);
        }
    }
    async setValue(table, value, config) {
        this.data[table] = value;
        this.save(table, config);
    }
    save(table, config) {
        const storage = this.getStorage(config);
        const v = this.data[table];
        if (v !== undefined) {
            try {
                storage.set(table, safeStringify(v));
            }
            catch (err) {
                console.error(err);
            }
        }
        else {
            storage.delete(table);
        }
    }
}

export { ObservablePersistMMKV };
//# sourceMappingURL=mmkv.mjs.map
