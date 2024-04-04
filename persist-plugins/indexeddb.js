'use strict';

var state = require('@legendapp/state');

const MetadataSuffix = '__legend_metadata';
function requestToPromise(request) {
    return new Promise((resolve) => (request.onsuccess = () => resolve()));
}
class ObservablePersistIndexedDB {
    constructor() {
        this.tableData = {};
        this.tableMetadata = {};
        this.tablesAdjusted = new Map();
        this.isSaveTaskQueued = false;
        this.pendingSaves = new Map();
        this.promisesQueued = [];
        this.doSave = this.doSave.bind(this);
    }
    async initialize(config) {
        if (typeof indexedDB === 'undefined')
            return;
        if (process.env.NODE_ENV === 'development' && !(config === null || config === void 0 ? void 0 : config.indexedDB)) {
            console.error('[legend-state] Must configure ObservablePersistIndexedDB');
        }
        const { databaseName, version, tableNames } = config.indexedDB;
        const openRequest = indexedDB.open(databaseName, version);
        openRequest.onerror = () => {
            console.error('Error', openRequest.error);
        };
        openRequest.onupgradeneeded = () => {
            const db = openRequest.result;
            const { tableNames } = config.indexedDB;
            // Create a table for each name with "id" as the key
            tableNames.forEach((table) => {
                if (!db.objectStoreNames.contains(table)) {
                    db.createObjectStore(table, {
                        keyPath: 'id',
                    });
                }
            });
        };
        return new Promise((resolve) => {
            openRequest.onsuccess = async () => {
                this.db = openRequest.result;
                // Load each table
                const objectStoreNames = this.db.objectStoreNames;
                const tables = tableNames.filter((table) => objectStoreNames.contains(table));
                try {
                    const transaction = this.db.transaction(tables, 'readonly');
                    await Promise.all(tables.map((table) => this.initTable(table, transaction)));
                }
                catch (err) {
                    console.error('[legend-state] Error loading IndexedDB', err);
                }
                resolve();
            };
        });
    }
    loadTable(table, config) {
        var _a;
        if (!this.tableData[table]) {
            const transaction = this.db.transaction(table, 'readonly');
            return this.initTable(table, transaction).then(() => this.loadTable(table, config));
        }
        const prefix = (_a = config.indexedDB) === null || _a === void 0 ? void 0 : _a.prefixID;
        if (prefix) {
            const tableName = prefix ? table + '/' + prefix : table;
            if (this.tablesAdjusted.has(tableName)) {
                const promise = state.when(this.tablesAdjusted.get(tableName));
                if (state.isPromise(promise)) {
                    return promise;
                }
            }
            else {
                const obsLoaded = state.observable(false);
                this.tablesAdjusted.set(tableName, obsLoaded);
                const data = this.getTable(table, config);
                let hasPromise = false;
                let promises;
                if (data) {
                    const keys = Object.keys(data);
                    promises = keys.map(async (key) => {
                        const value = data[key];
                        if (state.isPromise(value)) {
                            hasPromise = true;
                            return value.then(() => {
                                data[key] = value;
                            });
                        }
                        else {
                            data[key] = value;
                        }
                    });
                }
                if (hasPromise) {
                    return Promise.all(promises).then(() => {
                        obsLoaded.set(true);
                    });
                }
                else {
                    obsLoaded.set(true);
                }
            }
        }
    }
    getTable(table, config) {
        const configIDB = config.indexedDB;
        const prefix = configIDB === null || configIDB === void 0 ? void 0 : configIDB.prefixID;
        const data = this.tableData[prefix ? table + '/' + prefix : table];
        if (data && (configIDB === null || configIDB === void 0 ? void 0 : configIDB.itemID)) {
            return data[configIDB.itemID];
        }
        else {
            return data;
        }
    }
    getMetadata(table, config) {
        const { tableName } = this.getMetadataTableName(table, config);
        return this.tableMetadata[tableName];
    }
    async setMetadata(table, metadata, config) {
        const { tableName, tableNameBase } = this.getMetadataTableName(table, config);
        // Assign new metadata into the table, and make sure it has the id
        this.tableMetadata[tableName] = Object.assign(metadata, {
            id: tableNameBase + MetadataSuffix,
        });
        this.tableMetadata[tableName] = metadata;
        const store = this.transactionStore(table);
        return store.put(metadata);
    }
    async deleteMetadata(table, config) {
        const { tableName, tableNameBase } = this.getMetadataTableName(table, config);
        delete this.tableMetadata[tableName];
        const store = this.transactionStore(table);
        const key = tableNameBase + MetadataSuffix;
        store.delete(key);
    }
    async set(table, changes, config) {
        var _a, _b;
        if (typeof indexedDB === 'undefined')
            return;
        if (!this.pendingSaves.has(config)) {
            this.pendingSaves.set(config, {});
        }
        const pendingSaves = this.pendingSaves.get(config);
        const realTable = table;
        const prefixID = (_a = config.indexedDB) === null || _a === void 0 ? void 0 : _a.prefixID;
        if (prefixID) {
            table += '/' + prefixID;
        }
        const prev = this.tableData[table];
        const itemID = (_b = config.indexedDB) === null || _b === void 0 ? void 0 : _b.itemID;
        if (!pendingSaves[table]) {
            pendingSaves[table] = { tableName: realTable, items: new Set() };
        }
        const pendingTable = pendingSaves[table];
        // Combine changes into a minimal set of saves
        for (let i = 0; i < changes.length; i++) {
            // eslint-disable-next-line prefer-const
            let { path, valueAtPath, pathTypes } = changes[i];
            if (itemID) {
                path = [itemID].concat(path);
                pathTypes.splice(0, 0, 'object');
            }
            if (path.length > 0) {
                // If change is deep in an object save it to IDB by the first key
                const key = path[0];
                if (!this.tableData[table]) {
                    this.tableData[table] = {};
                }
                this.tableData[table] = state.setAtPath(this.tableData[table], path, pathTypes, valueAtPath);
                pendingTable.items.add(key);
            }
            else {
                // Set the whole table
                this.tableData[table] = valueAtPath;
                pendingTable.tablePrev = prev;
                break;
            }
        }
        return new Promise((resolve) => {
            this.promisesQueued.push(resolve);
            if (!this.isSaveTaskQueued) {
                this.isSaveTaskQueued = true;
                queueMicrotask(this.doSave);
            }
        });
    }
    async doSave() {
        this.isSaveTaskQueued = false;
        const promisesQueued = this.promisesQueued;
        this.promisesQueued = [];
        const promises = [];
        let lastPut;
        this.pendingSaves.forEach((pendingSaves, config) => {
            Object.keys(pendingSaves).forEach((table) => {
                const pendingTable = pendingSaves[table];
                const { tablePrev, items, tableName } = pendingTable;
                const store = this.transactionStore(tableName);
                const tableValue = this.tableData[table];
                if (tablePrev) {
                    promises.push(this._setTable(table, tablePrev, tableValue, store, config));
                }
                else {
                    items.forEach((key) => {
                        lastPut = this._setItem(table, key, tableValue[key], store, config);
                    });
                }
                // Clear pending saves
                items.clear();
                delete pendingTable.tablePrev;
            });
        });
        this.pendingSaves.clear();
        // setTable awaits multiple sets and deletes so we need to await that to get
        // the lastPut from it.
        if (promises.length) {
            const puts = await Promise.all(promises);
            lastPut = puts[puts.length - 1];
        }
        if (lastPut) {
            await requestToPromise(lastPut);
        }
        promisesQueued.forEach((resolve) => resolve());
    }
    async deleteTable(table, config) {
        const configIDB = config.indexedDB;
        const prefixID = configIDB === null || configIDB === void 0 ? void 0 : configIDB.prefixID;
        const tableName = prefixID ? table + '/' + prefixID : table;
        let data = this.tableData[tableName];
        const itemID = configIDB === null || configIDB === void 0 ? void 0 : configIDB.itemID;
        if (data && (configIDB === null || configIDB === void 0 ? void 0 : configIDB.itemID)) {
            const dataTemp = data[itemID];
            delete data[itemID];
            data = dataTemp;
        }
        else {
            delete this.tableData[tableName];
            delete this.tableData[tableName + '_transformed'];
        }
        if (typeof indexedDB === 'undefined')
            return;
        this.deleteMetadata(table, config);
        if (data) {
            const store = this.transactionStore(table);
            let result;
            if (!prefixID && !itemID) {
                result = requestToPromise(store.clear());
            }
            else {
                const keys = Object.keys(data);
                result = Promise.all(keys.map((key) => {
                    if (prefixID) {
                        key = prefixID + '/' + key;
                    }
                    return requestToPromise(store.delete(key));
                }));
            }
            // Clear the table from IDB
            return result;
        }
    }
    // Private
    getMetadataTableName(table, config) {
        const configIDB = config.indexedDB;
        let name = '';
        if (configIDB) {
            const { prefixID, itemID } = configIDB;
            if (itemID) {
                name = itemID;
            }
            if (prefixID) {
                name = prefixID + (name ? '/' + name : '');
            }
        }
        return { tableNameBase: name, tableName: name ? table + '/' + name : table };
    }
    initTable(table, transaction) {
        const store = transaction.objectStore(table);
        const allRequest = store.getAll();
        if (!this.tableData[table]) {
            this.tableData[table] = {};
        }
        return new Promise((resolve) => {
            allRequest.onsuccess = () => {
                const arr = allRequest.result;
                let metadata;
                if (!this.tableData[table]) {
                    this.tableData[table] = {};
                }
                for (let i = 0; i < arr.length; i++) {
                    const val = arr[i];
                    // In case id is a number convert it to a string
                    if (!val.id.includes) {
                        val.id = val.id + '';
                    }
                    if (val.id.endsWith(MetadataSuffix)) {
                        const id = val.id.replace(MetadataSuffix, '');
                        // Save this as metadata
                        delete val.id;
                        metadata = val;
                        const tableName = id ? table + '/' + id : table;
                        this.tableMetadata[tableName] = metadata;
                    }
                    else {
                        let tableName = table;
                        if (val.id.includes('/')) {
                            const [prefix, id] = val.id.split('/');
                            tableName += '/' + prefix;
                            val.id = id;
                        }
                        if (!this.tableData[tableName]) {
                            this.tableData[tableName] = {};
                        }
                        this.tableData[tableName][val.id] = val;
                    }
                }
                resolve();
            };
        });
    }
    transactionStore(table) {
        const transaction = this.db.transaction(table, 'readwrite');
        return transaction.objectStore(table);
    }
    _setItem(table, key, value, store, config) {
        var _a;
        if (!value) {
            if (this.tableData[table]) {
                delete this.tableData[table][key];
            }
            return store.delete(key);
        }
        else {
            if (state.isPrimitive(value))
                return;
            if (value.id === undefined) {
                // If value does not have its own ID, assign it the key from the Record
                value.id = key;
            }
            if (config) {
                if (!this.tableData[table]) {
                    this.tableData[table] = {};
                }
                this.tableData[table][key] = value;
                const prefixID = (_a = config.indexedDB) === null || _a === void 0 ? void 0 : _a.prefixID;
                if (prefixID) {
                    {
                        value = Object.assign({}, value, {
                            id: prefixID + '/' + value.id,
                        });
                    }
                }
            }
            return store.put(value);
        }
    }
    async _setTable(table, prev, value, store, config) {
        const keys = Object.keys(value);
        let lastSet;
        // Do a set for each key in the object
        const sets = await Promise.all(keys.map((key) => {
            const val = value[key];
            return this._setItem(table, key, val, store, config);
        }));
        lastSet = sets[sets.length - 1];
        // Delete keys that are no longer in the object
        if (prev) {
            const keysOld = Object.keys(prev);
            const deletes = (await Promise.all(keysOld.map((key) => {
                if (value[key] === undefined) {
                    return this._setItem(table, key, null, store, config);
                }
            }))).filter((a) => !!a);
            if (deletes.length > 0) {
                lastSet = deletes[deletes.length - 1];
            }
        }
        return lastSet;
    }
}

exports.ObservablePersistIndexedDB = ObservablePersistIndexedDB;
//# sourceMappingURL=indexeddb.js.map
