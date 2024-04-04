import { symbolDelete, isString, isArray, isObject, internal as internal$1, constructObjectWithPath, deconstructObjectWithPath, observable, when, batch, isObservable, isFunction, getNode, isPromise, mergeIntoObservable, isEmpty, setInObservableAtPath, setAtPath } from '@legendapp/state';

const observablePersistConfiguration = {};
function configureObservablePersistence(options) {
    Object.assign(observablePersistConfiguration, options);
}

const { initializePathType } = internal$1;
let validateMap;
function transformPath(path, pathTypes, map) {
    const data = {};
    let d = data;
    for (let i = 0; i < path.length; i++) {
        d = d[path[i]] = i === path.length - 1 ? null : initializePathType(pathTypes[i]);
    }
    let value = transformObject(data, map);
    const pathOut = [];
    for (let i = 0; i < path.length; i++) {
        const key = Object.keys(value)[0];
        pathOut.push(key);
        value = value[key];
    }
    return pathOut;
}
function transformObject(dataIn, map) {
    if (process.env.NODE_ENV === 'development') {
        validateMap(map);
    }
    let ret = dataIn;
    if (dataIn) {
        if (dataIn === symbolDelete)
            return dataIn;
        if (isString(dataIn)) {
            return map[dataIn];
        }
        ret = {};
        const dict = Object.keys(map).length === 1 && map['_dict'];
        for (const key in dataIn) {
            let v = dataIn[key];
            if (dict) {
                ret[key] = transformObject(v, dict);
            }
            else {
                const mapped = map[key];
                if (mapped === undefined) {
                    // Don't transform dateModified if user doesn't want it
                    if (key !== '@') {
                        ret[key] = v;
                        if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
                            console.error('A fatal field transformation error has occurred', key, dataIn, map);
                        }
                    }
                }
                else if (mapped !== null) {
                    if (v !== undefined && v !== null) {
                        if (map[key + '_val']) {
                            const mapChild = map[key + '_val'];
                            if (isArray(v)) {
                                v = v.map((vChild) => mapChild[vChild]);
                            }
                            else {
                                v = mapChild[v];
                            }
                        }
                        else if (map[key + '_arr'] && isArray(v)) {
                            const mapChild = map[key + '_arr'];
                            v = v.map((vChild) => transformObject(vChild, mapChild));
                        }
                        else if (isObject(v)) {
                            if (map[key + '_obj']) {
                                v = transformObject(v, map[key + '_obj']);
                            }
                            else if (map[key + '_dict']) {
                                const mapChild = map[key + '_dict'];
                                const out = {};
                                for (const keyChild in v) {
                                    out[keyChild] = transformObject(v[keyChild], mapChild);
                                }
                                v = out;
                            }
                        }
                    }
                    ret[mapped] = v;
                }
            }
        }
    }
    return ret;
}
function transformObjectWithPath(obj, path, pathTypes, fieldTransforms) {
    const constructed = constructObjectWithPath(path, pathTypes, obj);
    const transformed = transformObject(constructed, fieldTransforms);
    const transformedPath = transformPath(path, pathTypes, fieldTransforms);
    return { path: transformedPath, obj: deconstructObjectWithPath(transformedPath, pathTypes, transformed) };
}
const invertedMaps = new WeakMap();
function invertFieldMap(obj) {
    const existing = invertedMaps.get(obj);
    if (existing)
        return existing;
    const target = {};
    for (const key in obj) {
        const val = obj[key];
        if (key === '_dict') {
            target[key] = invertFieldMap(val);
        }
        else if (key.endsWith('_obj') || key.endsWith('_dict') || key.endsWith('_arr') || key.endsWith('_val')) {
            const keyMapped = obj[key.replace(/_obj|_dict|_arr|_val$/, '')];
            const suffix = key.match(/_obj|_dict|_arr|_val$/)[0];
            target[keyMapped + suffix] = invertFieldMap(val);
        }
        else if (typeof val === 'string') {
            target[val] = key;
        }
    }
    invertedMaps.set(obj, target);
    return target;
}
if (process.env.NODE_ENV === 'development') {
    validateMap = function (record) {
        const values = Object.values(record).filter((value) => {
            if (isObject(value)) {
                validateMap(value);
            }
            else {
                return isString(value);
            }
        });
        const uniques = Array.from(new Set(values));
        if (values.length !== uniques.length) {
            console.error('Field transform map has duplicate values', record, values.length, uniques.length);
        }
        return record;
    };
}

function observablePersistRemoteFunctionsAdapter({ get, set, }) {
    const ret = {};
    if (get) {
        ret.get = (async (params) => {
            const value = (await get(params));
            params.onChange({ value, dateModified: Date.now() });
            params.onGet();
        });
    }
    if (set) {
        ret.set = set;
    }
    return ret;
}

const mapPersistences = new WeakMap();
const persistState = observable({ inRemoteSync: false });
const metadatas = new WeakMap();
const promisesLocalSaves = new Set();
function parseLocalConfig(config) {
    return config
        ? isString(config)
            ? { table: config, config: { name: config } }
            : { table: config.name, config }
        : {};
}
function doInOrder(arg1, arg2) {
    return isPromise(arg1) ? arg1.then(arg2) : arg2(arg1);
}
function transformOutData(value, path, pathTypes, { transform, fieldTransforms }) {
    if (fieldTransforms || (transform === null || transform === void 0 ? void 0 : transform.out)) {
        const transformFn = () => {
            if (fieldTransforms) {
                const { obj, path: pathTransformed } = transformObjectWithPath(value, path, pathTypes, fieldTransforms);
                value = obj;
                path = pathTransformed;
            }
            return { value, path };
        };
        if (transform === null || transform === void 0 ? void 0 : transform.out) {
            const constructed = constructObjectWithPath(path, pathTypes, value);
            const saved = transform.out(constructed);
            const deconstruct = (toDeconstruct) => {
                value = deconstructObjectWithPath(path, pathTypes, toDeconstruct);
                return transformFn();
            };
            return doInOrder(saved, deconstruct);
        }
        return transformFn();
    }
    return { value, path };
}
function transformLoadData(value, { transform, fieldTransforms }, doUserTransform) {
    if (fieldTransforms) {
        const inverted = invertFieldMap(fieldTransforms);
        value = transformObject(value, inverted);
    }
    if (doUserTransform && (transform === null || transform === void 0 ? void 0 : transform.in)) {
        value = transform.in(value);
    }
    return value;
}
async function updateMetadataImmediate(obs, localState, syncState, persistOptions, newMetadata) {
    const saves = Array.from(promisesLocalSaves);
    if (saves.length > 0) {
        await Promise.all(saves);
    }
    const { persistenceLocal } = localState;
    const local = persistOptions.local;
    const { table, config } = parseLocalConfig(local);
    // Save metadata
    const oldMetadata = metadatas.get(obs);
    const { modified, pending } = newMetadata;
    const needsUpdate = pending || (modified && (!oldMetadata || modified !== oldMetadata.modified));
    if (needsUpdate) {
        const metadata = Object.assign({}, oldMetadata, newMetadata);
        metadatas.set(obs, metadata);
        if (persistenceLocal) {
            await persistenceLocal.setMetadata(table, metadata, config);
        }
        if (modified) {
            syncState.dateModified.set(modified);
        }
    }
}
function updateMetadata(obs, localState, syncState, persistOptions, newMetadata) {
    if (localState.timeoutSaveMetadata) {
        clearTimeout(localState.timeoutSaveMetadata);
    }
    localState.timeoutSaveMetadata = setTimeout(() => updateMetadataImmediate(obs, localState, syncState, persistOptions, newMetadata), 30);
}
let _queuedChanges = [];
async function processQueuedChanges() {
    // Get a local copy of the queued changes and clear the global queue
    const queuedChanges = _queuedChanges;
    _queuedChanges = [];
    // Note: Summary of the order of operations these functions:
    // 1. Prepare all changes for saving. This may involve waiting for promises if the user has asynchronous transform.
    // We need to prepare all of the changes in the queue before saving so that the saves happen in the correct order,
    // since some may take longer to transformSaveData than others.
    const changes = await Promise.all(queuedChanges.map(prepChange));
    // 2. Save pending to the metadata table first. If this is the only operation that succeeds, it would try to save
    // the current value again on next load, which isn't too bad.
    // 3. Save local changes to storage. If they never make it to remote, then on the next load they will be pending
    // and attempted again.
    // 4. Wait for remote load or error if allowed
    // 5. Save to remote
    // 6. On successful save, merge changes (if any) back into observable
    // 7. Lastly, update metadata to clear pending and update dateModified. Doing this earlier could potentially cause
    // sync inconsistences so it's very important that this is last.
    changes.forEach(doChange);
}
async function prepChange(queuedChange) {
    const { syncState, changes, localState, persistOptions, inRemoteChange, isApplyingPending } = queuedChange;
    const local = persistOptions.local;
    const { persistenceRemote } = localState;
    const { config: configLocal } = parseLocalConfig(local);
    const configRemote = persistOptions.remote;
    const saveLocal = local && !configLocal.readonly && !isApplyingPending && syncState.isEnabledLocal.peek();
    const saveRemote = !inRemoteChange && persistenceRemote && !(configRemote === null || configRemote === void 0 ? void 0 : configRemote.readonly) && syncState.isEnabledRemote.peek();
    if (saveLocal || saveRemote) {
        if (saveLocal && !syncState.isLoadedLocal.peek()) {
            console.error('[legend-state] WARNING: An observable was changed before being loaded from persistence', local);
            return;
        }
        const changesLocal = [];
        const changesRemote = [];
        const changesPaths = new Set();
        let promisesTransform = [];
        // Reverse order
        for (let i = changes.length - 1; i >= 0; i--) {
            const { path } = changes[i];
            let found = false;
            // Optimization to only save the latest update at each path. We might have multiple changes at the same path
            // and we only need the latest value, so it starts from the end of the array, skipping any earlier changes
            // already processed. If a later change modifies a parent of an earlier change (which happens on delete()
            // it should be ignored as it's superseded by the parent modification.
            if (changesPaths.size > 0) {
                for (let u = 0; u < path.length; u++) {
                    if (changesPaths.has((u === path.length - 1 ? path : path.slice(0, u + 1)).join('/'))) {
                        found = true;
                        break;
                    }
                }
            }
            if (!found) {
                const pathStr = path.join('/');
                changesPaths.add(pathStr);
                const { prevAtPath, valueAtPath, pathTypes } = changes[i];
                if (saveLocal) {
                    const promiseTransformLocal = transformOutData(valueAtPath, path, pathTypes, configLocal);
                    promisesTransform.push(doInOrder(promiseTransformLocal, ({ path: pathTransformed, value: valueTransformed }) => {
                        // If path includes undefined there was a null in fieldTransforms so don't need to save it
                        if (!pathTransformed.includes(undefined)) {
                            // Prepare the local change with the transformed path/value
                            changesLocal.push({
                                path: pathTransformed,
                                pathTypes,
                                prevAtPath,
                                valueAtPath: valueTransformed,
                                pathStr,
                            });
                        }
                    }));
                }
                if (saveRemote) {
                    const promiseTransformRemote = transformOutData(valueAtPath, path, pathTypes, configRemote || {});
                    promisesTransform.push(doInOrder(promiseTransformRemote, ({ path: pathTransformed, value: valueTransformed }) => {
                        var _a;
                        // If path includes undefined there was a null in fieldTransforms so don't need to save it
                        if (!pathTransformed.includes(undefined)) {
                            // Prepare pending changes
                            if (!localState.pendingChanges) {
                                localState.pendingChanges = {};
                            }
                            // First look for existing pending changes at a higher level than this change
                            // If they exist then merge this change into it
                            let found = false;
                            for (let i = 0; !found && i < path.length - 1; i++) {
                                const pathParent = path.slice(0, i + 1).join('/');
                                if ((_a = localState.pendingChanges[pathParent]) === null || _a === void 0 ? void 0 : _a.v) {
                                    found = true;
                                    const pathChild = path.slice(i + 1);
                                    const pathTypesChild = pathTypes.slice(i + 1);
                                    setAtPath(localState.pendingChanges[pathParent].v, pathChild, pathTypesChild, valueAtPath);
                                }
                            }
                            if (!found) {
                                // If an existing pending change is deeper than this change, just delete it
                                // in favor of this wider change
                                for (const key in localState.pendingChanges) {
                                    if (key !== pathStr && key.startsWith(pathStr)) {
                                        delete localState.pendingChanges[key];
                                    }
                                }
                                // The "p" saved in pending should be the previous state before changes,
                                // so don't overwrite it if it already exists
                                if (!localState.pendingChanges[pathStr]) {
                                    localState.pendingChanges[pathStr] = { p: prevAtPath !== null && prevAtPath !== void 0 ? prevAtPath : null, t: pathTypes };
                                }
                                // Pending value is the untransformed value because it gets loaded without transformment
                                // and forwarded through to onObsChange where it gets transformed before save
                                localState.pendingChanges[pathStr].v = valueAtPath;
                            }
                            // Prepare the remote change with the transformed path/value
                            changesRemote.push({
                                path: pathTransformed,
                                pathTypes,
                                prevAtPath,
                                valueAtPath: valueTransformed,
                                pathStr,
                            });
                        }
                    }));
                }
            }
        }
        // If there's any transform promises, wait for them before saving
        promisesTransform = promisesTransform.filter(Boolean);
        if (promisesTransform.length > 0) {
            await Promise.all(promisesTransform);
        }
        return { queuedChange, changesLocal, changesRemote };
    }
}
async function doChange(changeInfo) {
    var _a, _b, _c, _d;
    if (!changeInfo)
        return;
    const { queuedChange, changesLocal, changesRemote } = changeInfo;
    const { obs, syncState, localState, persistOptions } = queuedChange;
    const { persistenceLocal, persistenceRemote } = localState;
    const local = persistOptions.local;
    const { table, config: configLocal } = parseLocalConfig(local);
    const configRemote = persistOptions.remote;
    const shouldSaveMetadata = local && (configRemote === null || configRemote === void 0 ? void 0 : configRemote.offlineBehavior) === 'retry';
    if (changesRemote.length > 0 && shouldSaveMetadata) {
        // First save pending changes before saving local or remote
        await updateMetadataImmediate(obs, localState, syncState, persistOptions, {
            pending: localState.pendingChanges,
        });
    }
    if (changesLocal.length > 0) {
        // Save the changes to local persistence before saving to remote. They are already marked as pending so
        // if remote sync fails or the app is closed before remote sync, it will attempt to sync them on the next load.
        let promiseSet = persistenceLocal.set(table, changesLocal, configLocal);
        if (promiseSet) {
            promiseSet = promiseSet.then(() => {
                promisesLocalSaves.delete(promiseSet);
            });
            // Keep track of local save promises so that updateMetadata runs only after everything is saved
            promisesLocalSaves.add(promiseSet);
            // await the local save before proceeding to save remotely
            await promiseSet;
        }
    }
    if (changesRemote.length > 0) {
        // Wait for remote to be ready before saving
        await when(() => syncState.isLoaded.get() || ((configRemote === null || configRemote === void 0 ? void 0 : configRemote.allowSetIfError) && syncState.error.get()));
        const value = obs.peek();
        (_a = configRemote === null || configRemote === void 0 ? void 0 : configRemote.onBeforeSet) === null || _a === void 0 ? void 0 : _a.call(configRemote);
        const saved = await ((_b = persistenceRemote.set({
            obs,
            syncState: syncState,
            options: persistOptions,
            changes: changesRemote,
            value,
        })) === null || _b === void 0 ? void 0 : _b.catch((err) => { var _a; return (_a = configRemote === null || configRemote === void 0 ? void 0 : configRemote.onSetError) === null || _a === void 0 ? void 0 : _a.call(configRemote, err); }));
        // If this remote save changed anything then update persistence and metadata
        // Because save happens after a timeout and they're batched together, some calls to save will
        // return saved data and others won't, so those can be ignored.
        if (saved) {
            const pathStrs = Array.from(new Set(changesRemote.map((change) => change.pathStr)));
            const { changes, dateModified } = saved;
            if (pathStrs.length > 0) {
                if (local) {
                    const metadata = {};
                    const pending = (_c = persistenceLocal.getMetadata(table, configLocal)) === null || _c === void 0 ? void 0 : _c.pending;
                    let transformedChanges = [];
                    for (let i = 0; i < pathStrs.length; i++) {
                        const pathStr = pathStrs[i];
                        // Clear pending for this path
                        if (pending === null || pending === void 0 ? void 0 : pending[pathStr]) {
                            // Remove pending from local state
                            delete pending[pathStr];
                            metadata.pending = pending;
                        }
                    }
                    if (dateModified) {
                        metadata.modified = dateModified;
                    }
                    // Remote can optionally have data that needs to be merged back into the observable,
                    // for example Firebase may update dateModified with the server timestamp
                    if (changes && !isEmpty(changes)) {
                        transformedChanges.push(transformLoadData(changes, persistOptions.remote, false));
                    }
                    if (transformedChanges.length > 0) {
                        if (transformedChanges.some((change) => isPromise(change))) {
                            transformedChanges = await Promise.all(transformedChanges);
                        }
                        onChangeRemote(() => mergeIntoObservable(obs, ...transformedChanges));
                    }
                    if (shouldSaveMetadata && !isEmpty(metadata)) {
                        updateMetadata(obs, localState, syncState, persistOptions, metadata);
                    }
                }
                (_d = configRemote === null || configRemote === void 0 ? void 0 : configRemote.onSet) === null || _d === void 0 ? void 0 : _d.call(configRemote);
            }
        }
    }
}
function onObsChange(obs, syncState, localState, persistOptions, { changes }) {
    if (!internal$1.globalState.isLoadingLocal) {
        const inRemoteChange = internal$1.globalState.isLoadingRemote;
        const isApplyingPending = localState.isApplyingPending;
        // Queue changes in a microtask so that multiple changes within a frame get run together
        _queuedChanges.push({
            obs: obs,
            syncState,
            localState,
            persistOptions,
            changes,
            inRemoteChange,
            isApplyingPending: isApplyingPending,
        });
        if (_queuedChanges.length === 1) {
            queueMicrotask(processQueuedChanges);
        }
    }
}
function onChangeRemote(cb) {
    when(() => !persistState.inRemoteSync.get(), () => {
        // Remote changes should only update local state
        persistState.inRemoteSync.set(true);
        internal$1.globalState.isLoadingRemote = true;
        batch(cb, () => {
            internal$1.globalState.isLoadingRemote = false;
            persistState.inRemoteSync.set(false);
        });
    });
}
async function loadLocal(obs, persistOptions, syncState, localState) {
    var _a;
    const { local } = persistOptions;
    const localPersistence = persistOptions.pluginLocal || observablePersistConfiguration.pluginLocal;
    if (local) {
        const { table, config } = parseLocalConfig(local);
        if (!localPersistence) {
            throw new Error('Local persistence is not configured');
        }
        // Ensure there's only one instance of the persistence plugin
        if (!mapPersistences.has(localPersistence)) {
            const persistenceLocal = new localPersistence();
            const mapValue = { persist: persistenceLocal, initialized: observable(false) };
            mapPersistences.set(localPersistence, mapValue);
            if (persistenceLocal.initialize) {
                const initializePromise = (_a = persistenceLocal.initialize) === null || _a === void 0 ? void 0 : _a.call(persistenceLocal, observablePersistConfiguration.localOptions || {});
                if (isPromise(initializePromise)) {
                    await initializePromise;
                }
            }
            mapValue.initialized.set(true);
        }
        const { persist: persistenceLocal, initialized } = mapPersistences.get(localPersistence);
        localState.persistenceLocal = persistenceLocal;
        if (!initialized.get()) {
            await when(initialized);
        }
        // If persistence has an asynchronous load, wait for it
        if (persistenceLocal.loadTable) {
            const promise = persistenceLocal.loadTable(table, config);
            if (promise) {
                await promise;
            }
        }
        // Get the value from state
        let value = persistenceLocal.getTable(table, config);
        const metadata = persistenceLocal.getMetadata(table, config);
        if (metadata) {
            metadatas.set(obs, metadata);
            localState.pendingChanges = metadata.pending;
            syncState.dateModified.set(metadata.modified);
        }
        // Merge the data from local persistence into the default state
        if (value !== null && value !== undefined) {
            const { transform, fieldTransforms } = config;
            value = transformLoadData(value, { transform, fieldTransforms }, true);
            if (isPromise(value)) {
                value = await value;
            }
            batch(() => {
                // isLoadingLocal prevents saving remotely when two different persistences
                // are set on the same observable
                internal$1.globalState.isLoadingLocal = true;
                // We want to merge the local data on top of any initial state the object is created with
                mergeIntoObservable(obs, value);
            }, () => {
                internal$1.globalState.isLoadingLocal = false;
            });
        }
        const node = getNode(obs);
        node.state.peek().clearLocal = () => Promise.all([
            persistenceLocal.deleteTable(table, config),
            persistenceLocal.deleteMetadata(table, config),
        ]);
    }
    syncState.isLoadedLocal.set(true);
}
function persistObservable(initialOrObservable, persistOptions) {
    var _a;
    const obs = (isObservable(initialOrObservable)
        ? initialOrObservable
        : observable(isFunction(initialOrObservable) ? initialOrObservable() : initialOrObservable));
    const node = getNode(obs);
    if (process.env.NODE_ENV === 'development' && ((_a = obs === null || obs === void 0 ? void 0 : obs.peek()) === null || _a === void 0 ? void 0 : _a._state)) {
        console.warn('[legend-state] WARNING: persistObservable creates a property named "_state" but your observable already has "state" in it');
    }
    // Merge remote persist options with clobal options
    if (persistOptions.remote) {
        persistOptions.remote = Object.assign({}, observablePersistConfiguration.remoteOptions, persistOptions.remote);
    }
    let { remote } = persistOptions;
    const { local } = persistOptions;
    const remotePersistence = persistOptions.pluginRemote || (observablePersistConfiguration === null || observablePersistConfiguration === void 0 ? void 0 : observablePersistConfiguration.pluginRemote);
    const localState = {};
    const syncState = (node.state = observable({
        isLoadedLocal: false,
        isLoaded: false,
        isEnabledLocal: true,
        isEnabledRemote: true,
        clearLocal: undefined,
        sync: () => Promise.resolve(),
        getPendingChanges: () => localState.pendingChanges,
    }));
    loadLocal(obs, persistOptions, syncState, localState);
    if (remote || remotePersistence) {
        if (!remotePersistence) {
            throw new Error('Remote persistence is not configured');
        }
        if (!remote) {
            remote = {};
        }
        if (isObject(remotePersistence)) {
            localState.persistenceRemote = observablePersistRemoteFunctionsAdapter(remotePersistence);
        }
        else {
            // Ensure there's only one instance of the persistence plugin
            if (!mapPersistences.has(remotePersistence)) {
                mapPersistences.set(remotePersistence, {
                    persist: new remotePersistence(),
                });
            }
            localState.persistenceRemote = mapPersistences.get(remotePersistence)
                .persist;
        }
        let isSynced = false;
        const sync = async () => {
            var _a, _b;
            if (!isSynced) {
                isSynced = true;
                const dateModified = (_a = metadatas.get(obs)) === null || _a === void 0 ? void 0 : _a.modified;
                const get = (_b = localState.persistenceRemote.get) === null || _b === void 0 ? void 0 : _b.bind(localState.persistenceRemote);
                if (get) {
                    get({
                        state: syncState,
                        obs,
                        options: persistOptions,
                        dateModified,
                        onGet: () => {
                            syncState.isLoaded.set(true);
                        },
                        onChange: async ({ value, path = [], pathTypes = [], mode = 'set', dateModified }) => {
                            // Note: value is the constructed value, path is used for setInObservableAtPath
                            // to start the set into the observable from the path
                            if (value !== undefined) {
                                value = transformLoadData(value, remote, true);
                                if (isPromise(value)) {
                                    value = await value;
                                }
                                const invertedMap = remote.fieldTransforms && invertFieldMap(remote.fieldTransforms);
                                if (path.length && invertedMap) {
                                    path = transformPath(path, pathTypes, invertedMap);
                                }
                                if (mode === 'dateModified') {
                                    if (dateModified && !isEmpty(value)) {
                                        onChangeRemote(() => {
                                            setInObservableAtPath(obs, path, pathTypes, value, 'assign');
                                        });
                                    }
                                }
                                else {
                                    const pending = localState.pendingChanges;
                                    if (pending) {
                                        Object.keys(pending).forEach((key) => {
                                            const p = key.split('/').filter((p) => p !== '');
                                            const { v, t } = pending[key];
                                            if (value[p[0]] !== undefined) {
                                                value = setAtPath(value, p, t, v, obs.peek(), (path, value) => {
                                                    delete pending[key];
                                                    pending[path.join('/')] = {
                                                        p: null,
                                                        v: value,
                                                        t: t.slice(0, path.length),
                                                    };
                                                });
                                            }
                                        });
                                    }
                                    onChangeRemote(() => {
                                        setInObservableAtPath(obs, path, pathTypes, value, mode);
                                    });
                                }
                            }
                            if (dateModified && local) {
                                updateMetadata(obs, localState, syncState, persistOptions, {
                                    modified: dateModified,
                                });
                            }
                        },
                    });
                }
                else {
                    syncState.isLoaded.set(true);
                }
                // Wait for remote to be ready before saving pending
                await when(() => syncState.isLoaded.get() || (remote.allowSetIfError && syncState.error.get()));
                const pending = localState.pendingChanges;
                if (pending && !isEmpty(pending)) {
                    localState.isApplyingPending = true;
                    const keys = Object.keys(pending);
                    // Bundle up all the changes from pending
                    const changes = [];
                    for (let i = 0; i < keys.length; i++) {
                        const key = keys[i];
                        const path = key.split('/').filter((p) => p !== '');
                        const { p, v, t } = pending[key];
                        changes.push({ path, valueAtPath: v, prevAtPath: p, pathTypes: t });
                    }
                    // Send the changes into onObsChange so that they get persisted remotely
                    onObsChange(obs, syncState, localState, persistOptions, {
                        value: obs.peek(),
                        // TODO getPrevious if any remote persistence layers need it
                        getPrevious: () => undefined,
                        changes,
                    });
                    localState.isApplyingPending = false;
                }
            }
        };
        if (remote.manual) {
            syncState.assign({ sync });
        }
        else {
            when(() => !local || syncState.isLoadedLocal.get(), sync);
        }
    }
    when(!local || syncState.isLoadedLocal, function () {
        obs.onChange(onObsChange.bind(this, obs, syncState, localState, persistOptions));
    });
    return obs;
}

function isInRemoteChange() {
    return internal$1.globalState.isLoadingRemote;
}
const internal = {
    observablePersistConfiguration,
};

export { configureObservablePersistence, internal, invertFieldMap, isInRemoteChange, mapPersistences, onChangeRemote, persistObservable, persistState, transformObject, transformPath };
//# sourceMappingURL=persist.mjs.map
