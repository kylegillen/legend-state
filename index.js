'use strict';

const hasOwnProperty = Object.prototype.hasOwnProperty;
function isArray(obj) {
    return Array.isArray(obj);
}
function isString(obj) {
    return typeof obj === 'string';
}
function isObject(obj) {
    return !!obj && typeof obj === 'object' && !isArray(obj);
}
function isFunction(obj) {
    return typeof obj === 'function';
}
function isPrimitive(arg) {
    const type = typeof arg;
    return arg !== undefined && (isDate(arg) || (type !== 'object' && type !== 'function'));
}
function isDate(obj) {
    return obj instanceof Date;
}
function isSymbol(obj) {
    return typeof obj === 'symbol';
}
function isBoolean(obj) {
    return typeof obj === 'boolean';
}
function isPromise(obj) {
    return obj instanceof Promise;
}
function isEmpty(obj) {
    // Looping and returning false on the first property is faster than Object.keys(obj).length === 0
    // https://jsbench.me/qfkqv692c8
    if (!obj)
        return false;
    if (isArray(obj))
        return obj.length === 0;
    for (const key in obj) {
        if (hasOwnProperty.call(obj, key)) {
            return false;
        }
    }
    return true;
}
const setPrimitives = new Set(['boolean', 'string', 'number']);
/** @internal */
function isActualPrimitive(arg) {
    return setPrimitives.has(typeof arg);
}
/** @internal */
function isChildNodeValue(node) {
    return !!node.parent;
}

const symbolToPrimitive = Symbol.toPrimitive;
const symbolGetNode = Symbol('getNode');
const symbolDelete = /* @__PURE__ */ Symbol('delete');
const symbolOpaque = Symbol('opaque');
const optimized = Symbol('optimized');
// TODOV3 Remove these
const extraPrimitiveActivators = new Map();
const extraPrimitiveProps = new Map();
const globalState = {
    isLoadingLocal: false,
    isLoadingRemote: false,
    isMerging: false,
};
function checkActivate(node) {
    var _a;
    const root = node.root;
    (_a = root.activate) === null || _a === void 0 ? void 0 : _a.call(root);
    if (root.toActivate) {
        root.toActivate.forEach(checkActivate);
        delete root.toActivate;
    }
}
function getNode(obs) {
    return obs && obs[symbolGetNode];
}
function setNodeValue(node, newValue) {
    var _a;
    const parentNode = (_a = node.parent) !== null && _a !== void 0 ? _a : node;
    const key = node.parent ? node.key : '_';
    const isDelete = newValue === symbolDelete;
    if (isDelete)
        newValue = undefined;
    // Get the value of the parent
    // const parentValue = isRoot ? node.root : ensureNodeValue(node);
    const parentValue = node.parent ? ensureNodeValue(parentNode) : parentNode.root;
    // Save the previous value first
    const prevValue = parentValue[key];
    const isFunc = isFunction(newValue);
    // Compute newValue if newValue is a function or an observable
    newValue =
        !parentNode.isAssigning && isFunc
            ? newValue(prevValue)
            : isObject(newValue) && (newValue === null || newValue === void 0 ? void 0 : newValue[symbolGetNode])
                ? newValue.peek()
                : newValue;
    try {
        parentNode.isSetting = (parentNode.isSetting || 0) + 1;
        // Save the new value
        if (isDelete) {
            delete parentValue[key];
        }
        else {
            parentValue[key] = newValue;
        }
    }
    finally {
        parentNode.isSetting--;
    }
    if (parentNode.root.locked && parentNode.root.set) {
        parentNode.root.set(parentNode.root._);
    }
    return { prevValue, newValue, parentValue };
}
const arrNodeKeys = [];
function getNodeValue(node) {
    let count = 0;
    let n = node;
    while (isChildNodeValue(n)) {
        arrNodeKeys[count++] = n.key;
        n = n.parent;
    }
    let child = node.root._;
    for (let i = count - 1; child && i >= 0; i--) {
        const key = arrNodeKeys[i];
        child = key !== 'size' && (child instanceof Map || child instanceof WeakMap) ? child.get(key) : child[key];
    }
    return child;
}
function getChildNode(node, key) {
    var _a;
    // Get the child by key
    let child = (_a = node.children) === null || _a === void 0 ? void 0 : _a.get(key);
    // Create the child node if it doesn't already exist
    if (!child) {
        child = {
            root: node.root,
            parent: node,
            key,
            lazy: true,
        };
        if (!node.children) {
            node.children = new Map();
        }
        node.children.set(key, child);
    }
    return child;
}
function ensureNodeValue(node) {
    let value = getNodeValue(node);
    if (!value) {
        if (isChildNodeValue(node)) {
            const parent = ensureNodeValue(node.parent);
            value = parent[node.key] = {};
        }
        else {
            value = node.root._ = {};
        }
    }
    return value;
}
function findIDKey(obj, node) {
    let idKey = isObject(obj)
        ? 'id' in obj
            ? 'id'
            : 'key' in obj
                ? 'key'
                : '_id' in obj
                    ? '_id'
                    : '__id' in obj
                        ? '__id'
                        : undefined
        : undefined;
    if (!idKey && node.parent) {
        const keyExtractor = getNodeValue(node.parent)[node.key + '_keyExtractor'];
        if (keyExtractor && isFunction(keyExtractor)) {
            idKey = keyExtractor;
        }
    }
    return idKey;
}
function extractFunction(node, key, fnOrComputed, computedChildNode) {
    if (!node.functions) {
        node.functions = new Map();
    }
    node.functions.set(key, fnOrComputed);
    if (computedChildNode) {
        computedChildNode.parentOther = getChildNode(node, key);
        if (!node.root.toActivate) {
            node.root.toActivate = [];
        }
        node.root.toActivate.push(computedChildNode);
    }
}

function isObservable(obs) {
    return obs && !!obs[symbolGetNode];
}
function isEvent(obs) {
    var _a;
    return obs && ((_a = obs[symbolGetNode]) === null || _a === void 0 ? void 0 : _a.isEvent);
}
function computeSelector(selector, e, retainObservable) {
    let c = selector;
    if (isFunction(c)) {
        c = e ? c(e) : c();
    }
    return isObservable(c) && !retainObservable ? c.get() : c;
}
function getObservableIndex(obs) {
    const node = getNode(obs);
    const n = +node.key;
    return n - n < 1 ? +n : -1;
}
function opaqueObject(value) {
    if (value) {
        value[symbolOpaque] = true;
    }
    return value;
}
function lockObservable(obs, value) {
    var _a;
    const root = (_a = getNode(obs)) === null || _a === void 0 ? void 0 : _a.root;
    if (root) {
        root.locked = value;
    }
}
function setAtPath(obj, path, pathTypes, value, fullObj, restore) {
    let o = obj;
    let oFull = fullObj;
    if (path.length > 0) {
        for (let i = 0; i < path.length; i++) {
            const p = path[i];
            if (i === path.length - 1) {
                // Don't set if the value is the same. This prevents creating a new key
                // when setting undefined on an object without this key
                if (o[p] !== value) {
                    o[p] = value;
                }
            }
            else if (o[p] === symbolDelete) {
                // If this was previously deleted, restore it
                if (oFull) {
                    o[p] = oFull[p];
                    restore === null || restore === void 0 ? void 0 : restore(path.slice(0, i + 1), o[p]);
                }
                break;
            }
            else if (o[p] === undefined || o[p] === null) {
                o[p] = initializePathType(pathTypes[i]);
            }
            o = o[p];
            if (oFull) {
                oFull = oFull[p];
            }
        }
    }
    else {
        obj = value;
    }
    return obj;
}
function setInObservableAtPath(obs, path, pathTypes, value, mode) {
    let o = obs;
    let v = value;
    for (let i = 0; i < path.length; i++) {
        const p = path[i];
        if (!o.peek()[p]) {
            o[p].set(initializePathType(pathTypes[i]));
        }
        o = o[p];
        v = v[p];
    }
    if (v === symbolDelete) {
        o.delete();
    }
    // Assign if possible, or set otherwise
    else if (mode === 'assign' && o.assign && isObject(o.peek())) {
        o.assign(v);
    }
    else {
        o.set(v);
    }
}
function mergeIntoObservable(target, ...sources) {
    beginBatch();
    globalState.isMerging = true;
    for (let i = 0; i < sources.length; i++) {
        target = _mergeIntoObservable(target, sources[i]);
    }
    globalState.isMerging = false;
    endBatch();
    return target;
}
function _mergeIntoObservable(target, source) {
    var _a;
    const needsSet = isObservable(target);
    const targetValue = needsSet ? target.peek() : target;
    const isTargetArr = isArray(targetValue);
    const isTargetObj = !isTargetArr && isObject(targetValue);
    if ((isTargetObj && isObject(source) && !isEmpty(targetValue)) ||
        (isTargetArr && isArray(source) && targetValue.length > 0)) {
        const keys = Object.keys(source);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const sourceValue = source[key];
            if (sourceValue === symbolDelete) {
                needsSet && ((_a = target[key]) === null || _a === void 0 ? void 0 : _a.delete) ? target[key].delete() : delete target[key];
            }
            else {
                const isObj = isObject(sourceValue);
                const isArr = !isObj && isArray(sourceValue);
                const targetChild = target[key];
                if ((isObj || isArr) && targetChild && (needsSet || !isEmpty(targetChild))) {
                    if (!needsSet && (!targetChild || (isObj ? !isObject(targetChild) : !isArray(targetChild)))) {
                        target[key] = sourceValue;
                    }
                    else {
                        _mergeIntoObservable(targetChild, sourceValue);
                    }
                }
                else {
                    needsSet
                        ? targetChild.set(sourceValue)
                        : (target[key] = sourceValue);
                }
            }
        }
    }
    else if (source !== undefined) {
        needsSet ? target.set(source) : (target = source);
    }
    return target;
}
function constructObjectWithPath(path, pathTypes, value) {
    let out;
    if (path.length > 0) {
        let o = (out = {});
        for (let i = 0; i < path.length; i++) {
            const p = path[i];
            o[p] = i === path.length - 1 ? value : initializePathType(pathTypes[i]);
            o = o[p];
        }
    }
    else {
        out = value;
    }
    return out;
}
function deconstructObjectWithPath(path, pathTypes, value) {
    let o = value;
    for (let i = 0; i < path.length; i++) {
        const p = path[i];
        o = o ? o[p] : initializePathType(pathTypes[i]);
    }
    return o;
}
function isObservableValueReady(value) {
    return !!value && ((!isObject(value) && !isArray(value)) || !isEmpty(value));
}
function setSilently(obs, newValue) {
    const node = getNode(obs);
    return setNodeValue(node, newValue).newValue;
}
function getPathType(value) {
    return isArray(value) ? 'array' : value instanceof Map ? 'map' : value instanceof Set ? 'set' : 'object';
}
function initializePathType(pathType) {
    switch (pathType) {
        case 'array':
            return [];
        case 'object':
            return {};
        case 'map':
            return new Map();
        case 'set':
            return new Set();
    }
}
function replacer(_, value) {
    if (value instanceof Map) {
        return {
            __LSType: 'Map',
            value: Array.from(value.entries()), // or with spread: value: [...value]
        };
    }
    else if (value instanceof Set) {
        return {
            __LSType: 'Set',
            value: Array.from(value), // or with spread: value: [...value]
        };
    }
    else {
        return value;
    }
}
function reviver(_, value) {
    if (typeof value === 'object' && value) {
        if (value.__LSType === 'Map') {
            return new Map(value.value);
        }
        else if (value.__LSType === 'Set') {
            return new Set(value.value);
        }
    }
    return value;
}
function safeStringify(value) {
    return JSON.stringify(value, replacer);
}
function safeParse(value) {
    return JSON.parse(value, reviver);
}
function clone(value) {
    return safeParse(safeStringify(value));
}

let timeout;
let numInBatch = 0;
let isRunningBatch = false;
let didDelayEndBatch = false;
let _afterBatch = [];
let _queuedBatches = [];
let _batchMap = new Map();
function onActionTimeout() {
    if (_batchMap.size > 0) {
        if (process.env.NODE_ENV === 'development') {
            console.error('Forcibly completing observableBatcher because end() was never called. This may be due to an uncaught error between begin() and end().');
        }
        endBatch(/*force*/ true);
    }
}
function isArraySubset(mainArr, subsetArr) {
    for (let i = 0; i < mainArr.length; i++) {
        if (mainArr[i] !== subsetArr[i]) {
            return false;
        }
    }
    return true;
}
function createPreviousHandlerInner(value, changes) {
    // Clones the current state and inject the previous data at the changed path
    let cloned = value ? clone(value) : {};
    for (let i = 0; i < changes.length; i++) {
        const { path, prevAtPath } = changes[i];
        let o = cloned;
        if (path.length > 0) {
            let i;
            for (i = 0; i < path.length - 1; i++) {
                o = o[path[i]];
            }
            const key = path[i];
            if (o instanceof Map) {
                o.set(key, prevAtPath);
            }
            else {
                o[key] = prevAtPath;
            }
        }
        else {
            cloned = prevAtPath;
        }
    }
    return cloned;
}
function createPreviousHandler(value, changes) {
    // Create a function that generates the previous state
    // We don't want to always do this because cloning is expensive
    // so it's better to run on demand.
    return function () {
        return createPreviousHandlerInner(value, changes);
    };
}
function notify(node, value, prev, level, whenOptimizedOnlyIf) {
    // Run immediate listeners if there are any
    const changesInBatch = new Map();
    computeChangesRecursive(changesInBatch, node, value, [], [], value, prev, 
    /*immediate*/ true, level, whenOptimizedOnlyIf);
    batchNotifyChanges(changesInBatch, /*immediate*/ true);
    // Update the current batch
    const existing = _batchMap.get(node);
    if (existing) {
        existing.value = value;
        // TODO: level, whenOptimizedOnlyIf
    }
    else {
        _batchMap.set(node, { value, prev, level, whenOptimizedOnlyIf });
    }
    // If not in a batch run it immediately
    if (numInBatch <= 0) {
        runBatch();
    }
}
function computeChangesAtNode(changesInBatch, node, value, path, pathTypes, valueAtPath, prevAtPath, immediate, level, whenOptimizedOnlyIf) {
    // If there are listeners at this node compute the changes that need to be run
    if (immediate ? node.listenersImmediate : node.listeners) {
        const change = {
            path,
            pathTypes,
            valueAtPath,
            prevAtPath,
        };
        const changeInBatch = changesInBatch.get(node);
        // If the node itself has been changed then we can ignore all the child changes
        if (changeInBatch && path.length > 0) {
            const { changes } = changeInBatch;
            if (!isArraySubset(changes[0].path, change.path)) {
                changes.push(change);
            }
        }
        else {
            changesInBatch.set(node, {
                level,
                value,
                whenOptimizedOnlyIf,
                changes: [change],
            });
        }
    }
}
function computeChangesRecursive(changesInBatch, node, value, path, pathTypes, valueAtPath, prevAtPath, immediate, level, whenOptimizedOnlyIf) {
    // Do the compute at this node
    computeChangesAtNode(changesInBatch, node, value, path, pathTypes, valueAtPath, prevAtPath, immediate, level, whenOptimizedOnlyIf);
    if (node.linkedFromNodes) {
        for (const linkedFromNode of node.linkedFromNodes) {
            computeChangesAtNode(changesInBatch, linkedFromNode, value, path, pathTypes, valueAtPath, prevAtPath, immediate, level, whenOptimizedOnlyIf);
        }
    }
    // If not root notify up through parents
    if (node.parent) {
        const parent = node.parent;
        if (parent) {
            const parentValue = getNodeValue(parent);
            computeChangesRecursive(changesInBatch, parent, parentValue, [node.key].concat(path), [getPathType(value)].concat(pathTypes), valueAtPath, prevAtPath, immediate, level + 1, whenOptimizedOnlyIf);
        }
    }
}
function batchNotifyChanges(changesInBatch, immediate) {
    const listenersNotified = new Set();
    // For each change in the batch, notify all of the listeners
    changesInBatch.forEach(({ changes, level, value, whenOptimizedOnlyIf }, node) => {
        const listeners = immediate ? node.listenersImmediate : node.listeners;
        if (listeners) {
            let listenerParams;
            // Need to convert to an array here instead of using a for...of loop because listeners can change while iterating
            const arr = Array.from(listeners);
            for (let i = 0; i < arr.length; i++) {
                const listenerFn = arr[i];
                const { track, noArgs, listener } = listenerFn;
                if (!listenersNotified.has(listener)) {
                    const ok = track === true ? level <= 0 : track === optimized ? whenOptimizedOnlyIf && level <= 0 : true;
                    // Notify if listener is not shallow or if this is the first level
                    if (ok) {
                        // Create listenerParams if not already created
                        if (!noArgs && !listenerParams) {
                            listenerParams = {
                                value,
                                getPrevious: createPreviousHandler(value, changes),
                                changes,
                            };
                        }
                        if (!track) {
                            listenersNotified.add(listener);
                        }
                        listener(listenerParams);
                    }
                }
            }
        }
    });
}
function runBatch() {
    // Save batch locally and reset _batchMap first because a new batch could begin while looping over callbacks.
    // This can happen with observableComputed for example.
    const map = _batchMap;
    _batchMap = new Map();
    const changesInBatch = new Map();
    // First compute all of the changes at each node. It's important to do this first before
    // running all the notifications because createPreviousHandler depends on knowing
    // all of the changes happening at the node.
    map.forEach(({ value, prev, level, whenOptimizedOnlyIf }, node) => {
        computeChangesRecursive(changesInBatch, node, value, [], [], value, prev, false, level, whenOptimizedOnlyIf);
    });
    // Once all changes are computed, notify all listeners for each node with the computed changes.
    batchNotifyChanges(changesInBatch, false);
}
function batch(fn, onComplete) {
    if (onComplete) {
        // If there's an onComplete we need a batch that's fully isolated from others to ensure it wraps only the given changes.
        // So if already batching, push this batch onto a queue and run it after the current batch is fully done.
        if (isRunningBatch) {
            _queuedBatches.push([fn, onComplete]);
            return;
        }
        else {
            _afterBatch.push(onComplete);
        }
    }
    beginBatch();
    try {
        fn();
    }
    finally {
        endBatch();
    }
}
function beginBatch() {
    numInBatch++;
    if (!timeout) {
        timeout = setTimeout(onActionTimeout, 0);
    }
}
function endBatch(force) {
    numInBatch--;
    if (numInBatch <= 0 || force) {
        if (isRunningBatch) {
            // Don't want to run multiple endBatches recursively, so just note that an endBatch
            // was delayed so that the top level endBatch will run endBatch again after it's done.
            didDelayEndBatch = true;
        }
        else {
            if (timeout) {
                clearTimeout(timeout);
                timeout = undefined;
            }
            numInBatch = 0;
            // Save batch locally and reset _batch first because a new batch could begin while looping over callbacks.
            // This can happen with observableComputed for example.
            const after = _afterBatch;
            if (after.length) {
                _afterBatch = [];
            }
            isRunningBatch = true;
            runBatch();
            isRunningBatch = false;
            // Run after functions at the end of this batch before running the next batch.
            // This needs to run before the delayed endBatch because the after functions need
            // to run before any side effects of the batch
            for (let i = 0; i < after.length; i++) {
                after[i]();
            }
            // If an endBatch was delayed run it now
            if (didDelayEndBatch) {
                didDelayEndBatch = false;
                endBatch(true);
            }
            const queued = _queuedBatches;
            if (queued.length) {
                _queuedBatches = [];
                for (let i = 0; i < queued.length; i++) {
                    const [fn, onComplete] = queued[i];
                    batch(fn, onComplete);
                }
            }
        }
    }
}

function createObservable(value, makePrimitive, createObject, createPrimitive) {
    const valueIsPromise = isPromise(value);
    const root = {
        _: value,
    };
    const node = {
        root,
        lazy: true,
    };
    const prim = makePrimitive || isActualPrimitive(value);
    const obs = prim
        ? new createPrimitive(node)
        : createObject(node);
    if (valueIsPromise) {
        extractPromise(node, value);
    }
    return obs;
}

function onChange(node, callback, options = {}) {
    const { initial, immediate, noArgs } = options;
    const { trackingType } = options;
    let listeners = immediate ? node.listenersImmediate : node.listeners;
    if (!listeners) {
        listeners = new Set();
        if (immediate) {
            node.listenersImmediate = listeners;
        }
        else {
            node.listeners = listeners;
        }
    }
    checkActivate(node);
    const listener = {
        listener: callback,
        track: trackingType,
        noArgs,
    };
    listeners.add(listener);
    if (initial) {
        const value = getNodeValue(node);
        callback({
            value,
            changes: [
                {
                    path: [],
                    pathTypes: [],
                    prevAtPath: value,
                    valueAtPath: value,
                },
            ],
            getPrevious: () => undefined,
        });
    }
    return () => listeners.delete(listener);
}

let trackCount = 0;
const trackingQueue = [];
const tracking = {
    current: undefined,
};
function beginTracking() {
    // Keep a copy of the previous tracking context so it can be restored
    // when this context is complete
    trackingQueue.push(tracking.current);
    trackCount++;
    tracking.current = {};
}
function endTracking() {
    // Restore the previous tracking context
    trackCount--;
    if (trackCount < 0) {
        trackCount = 0;
    }
    tracking.current = trackingQueue.pop();
}
function updateTracking(node, track) {
    if (trackCount) {
        const tracker = tracking.current;
        if (tracker) {
            if (!tracker.nodes) {
                tracker.nodes = new Map();
            }
            const existing = tracker.nodes.get(node);
            if (existing) {
                existing.track = existing.track || track;
                existing.num++;
            }
            else {
                tracker.nodes.set(node, { node, track, num: 1 });
            }
        }
    }
}

const ArrayModifiers = new Set([
    'copyWithin',
    'fill',
    'from',
    'pop',
    'push',
    'reverse',
    'shift',
    'sort',
    'splice',
    'unshift',
]);
const ArrayLoopers = new Set([
    'every',
    'filter',
    'find',
    'findIndex',
    'forEach',
    'join',
    'map',
    'some',
]);
const ArrayLoopersReturn = new Set(['filter', 'find']);
const observableProperties = new Map();
const observableFns = new Map([
    ['get', get],
    ['set', set],
    ['peek', peek],
    ['onChange', onChange],
    ['assign', assign],
    ['delete', deleteFn],
    ['toggle', toggle],
]);
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    // eslint-disable-next-line no-var
    var __devUpdateNodes = new Set();
}
function collectionSetter(node, target, prop, ...args) {
    var _a;
    const prevValue = (isArray(target) && target.slice()) || target;
    const ret = target[prop].apply(target, args);
    if (node) {
        const hasParent = isChildNodeValue(node);
        const key = hasParent ? node.key : '_';
        const parentValue = hasParent ? getNodeValue(node.parent) : node.root;
        // Set the object to the previous value first
        parentValue[key] = prevValue;
        // Then set with the new value so it notifies with the correct prevValue
        setKey((_a = node.parent) !== null && _a !== void 0 ? _a : node, key, target);
    }
    // Return the original value
    return ret;
}
function getKeys(obj, isArr, isMap) {
    return isArr ? undefined : obj ? (isMap ? Array.from(obj.keys()) : Object.keys(obj)) : [];
}
function updateNodes(parent, obj, prevValue) {
    var _a, _b;
    if ((process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
        typeof __devUpdateNodes !== 'undefined' &&
        isObject(obj)) {
        if (__devUpdateNodes.has(obj)) {
            console.error('[legend-state] Circular reference detected in object. You may want to use opaqueObject to stop traversing child nodes.', obj);
            return false;
        }
        __devUpdateNodes.add(obj);
    }
    if ((isObject(obj) && obj[symbolOpaque]) ||
        (isObject(prevValue) && prevValue[symbolOpaque])) {
        const isDiff = obj !== prevValue;
        if (isDiff) {
            if (parent.listeners || parent.listenersImmediate) {
                notify(parent, obj, prevValue, 0);
            }
        }
        if ((process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
            typeof __devUpdateNodes !== 'undefined' &&
            obj !== undefined) {
            __devUpdateNodes.delete(obj);
        }
        return isDiff;
    }
    const isArr = isArray(obj);
    let prevChildrenById;
    let moved;
    const isMap = obj instanceof Map;
    const keys = getKeys(obj, isArr, isMap);
    const keysPrev = getKeys(prevValue, isArr, isMap);
    const length = ((_a = (keys || obj)) === null || _a === void 0 ? void 0 : _a.length) || 0;
    const lengthPrev = ((_b = (keysPrev || prevValue)) === null || _b === void 0 ? void 0 : _b.length) || 0;
    let idField;
    let isIdFieldFunction;
    let hasADiff = false;
    let retValue;
    if (isArr && isArray(prevValue)) {
        // Construct a map of previous indices for computing move
        if (prevValue.length > 0) {
            const firstPrevValue = prevValue[0];
            if (firstPrevValue !== undefined) {
                idField = findIDKey(firstPrevValue, parent);
                if (idField) {
                    isIdFieldFunction = isFunction(idField);
                    prevChildrenById = new Map();
                    moved = [];
                    const keysSeen = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
                        ? new Set()
                        : undefined;
                    if (parent.children) {
                        for (let i = 0; i < prevValue.length; i++) {
                            const p = prevValue[i];
                            if (p) {
                                const child = parent.children.get(i + '');
                                if (child) {
                                    const key = isIdFieldFunction
                                        ? idField(p)
                                        : p[idField];
                                    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
                                        if (keysSeen.has(key)) {
                                            console.warn(`[legend-state] Warning: Multiple elements in array have the same ID. Key field: ${idField}, Array:`, prevValue);
                                        }
                                        keysSeen.add(key);
                                    }
                                    prevChildrenById.set(key, child);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    else if (prevValue && (!obj || isObject(obj))) {
        // For keys that have been removed from object, notify and update children recursively
        const lengthPrev = keysPrev.length;
        for (let i = 0; i < lengthPrev; i++) {
            const key = keysPrev[i];
            if (!keys.includes(key)) {
                hasADiff = true;
                const child = getChildNode(parent, key);
                const prev = isMap ? prevValue.get(key) : prevValue[key];
                if (prev !== undefined) {
                    if (!isPrimitive(prev)) {
                        updateNodes(child, undefined, prev);
                    }
                    if (child.listeners || child.listenersImmediate) {
                        notify(child, undefined, prev, 0);
                    }
                }
            }
        }
    }
    if (obj && !isPrimitive(obj)) {
        hasADiff = hasADiff || length !== lengthPrev;
        const isArrDiff = hasADiff;
        let didMove = false;
        for (let i = 0; i < length; i++) {
            const key = isArr ? i + '' : keys[i];
            const value = isMap ? obj.get(key) : obj[key];
            const prev = isMap ? prevValue === null || prevValue === void 0 ? void 0 : prevValue.get(key) : prevValue === null || prevValue === void 0 ? void 0 : prevValue[key];
            let isDiff = value !== prev;
            if (isDiff) {
                const id = idField && value
                    ? isIdFieldFunction
                        ? idField(value)
                        : value[idField]
                    : undefined;
                let child = getChildNode(parent, key);
                // Detect moves within an array. Need to move the original proxy to the new position to keep
                // the proxy stable, so that listeners to this node will be unaffected by the array shift.
                if (isArr && id !== undefined) {
                    // Find the previous position of this element in the array
                    const prevChild = id !== undefined ? prevChildrenById === null || prevChildrenById === void 0 ? void 0 : prevChildrenById.get(id) : undefined;
                    if (!prevChild) {
                        // This id was not in the array before so it does not need to notify children
                        isDiff = false;
                        hasADiff = true;
                    }
                    else if (prevChild !== undefined && prevChild.key !== key) {
                        const valuePrevChild = prevValue[prevChild.key];
                        // If array length changed then move the original node to the current position.
                        // That should be faster than notifying every single element that
                        // it's in a new position.
                        if (isArrDiff) {
                            child = prevChild;
                            parent.children.delete(child.key);
                            child.key = key;
                            moved.push([key, child]);
                        }
                        didMove = true;
                        // And check for diff against the previous value in the previous position
                        isDiff = valuePrevChild !== value;
                    }
                }
                if (isDiff) {
                    // Array has a new / modified element
                    // If object iterate through its children
                    if (isPrimitive(value)) {
                        hasADiff = true;
                    }
                    else {
                        // Always need to updateNodes so we notify through all children
                        const updatedNodes = updateNodes(child, value, prev);
                        hasADiff = hasADiff || updatedNodes;
                    }
                }
                if (isDiff || !isArrDiff) {
                    // Notify for this child if this element is different and it has listeners
                    // Or if the position changed in an array whose length did not change
                    // But do not notify child if the parent is an array with changing length -
                    // the array's listener will cover it
                    if (child.listeners || child.listenersImmediate) {
                        notify(child, value, prev, 0, !isArrDiff);
                    }
                }
            }
        }
        if (moved) {
            for (let i = 0; i < moved.length; i++) {
                const [key, child] = moved[i];
                parent.children.set(key, child);
            }
        }
        // The full array does not need to re-render if the length is the same
        // So don't notify shallow listeners
        retValue = hasADiff || didMove;
    }
    else if (prevValue !== undefined) {
        // If value got set to undefined, it has a diff
        retValue = true;
    }
    if ((process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
        typeof __devUpdateNodes !== 'undefined' &&
        obj !== undefined) {
        __devUpdateNodes.delete(obj);
    }
    return retValue !== null && retValue !== void 0 ? retValue : false;
}
function getProxy(node, p) {
    // Get the child node if p prop
    if (p !== undefined)
        node = getChildNode(node, p);
    // Create a proxy if not already cached and return it
    return (node.proxy || (node.proxy = new Proxy(node, proxyHandler)));
}
const proxyHandler = {
    get(node, p, receiver) {
        var _a;
        if (p === symbolToPrimitive) {
            throw new Error(process.env.NODE_ENV === 'development'
                ? '[legend-state] observable should not be used as a primitive. You may have forgotten to use .get() or .peek() to get the value of the observable.'
                : '[legend-state] observable is not a primitive.');
        }
        if (p === symbolGetNode) {
            return node;
        }
        const value = peek(node);
        // If this node is linked to another observable then forward to the target's handler.
        // The exception is onChange because it needs to listen to this node for changes.
        // This needs to be below peek because it activates there.
        if (node.linkedToNode && p !== 'onChange') {
            return proxyHandler.get(node.linkedToNode, p, receiver);
        }
        if (value instanceof Map || value instanceof WeakMap || value instanceof Set || value instanceof WeakSet) {
            const ret = handlerMapSet(node, p, value);
            if (ret !== undefined) {
                return ret;
            }
        }
        const fn = observableFns.get(p);
        // If this is an observable function, call it
        if (fn) {
            return function (a, b, c) {
                const l = arguments.length;
                // Array call and apply are slow so micro-optimize this hot path.
                // The observable functions depends on the number of arguments so we have to
                // call it with the correct arguments, not just undefined
                switch (l) {
                    case 0:
                        return fn(node);
                    case 1:
                        return fn(node, a);
                    case 2:
                        return fn(node, a, b);
                    default:
                        return fn(node, a, b, c);
                }
            };
        }
        if (node.isComputed) {
            if (node.proxyFn && !fn) {
                return node.proxyFn(p);
            }
            else {
                checkActivate(node);
            }
        }
        const property = observableProperties.get(p);
        if (property) {
            return property.get(node);
        }
        // TODOV3 Remove this
        const isValuePrimitive = isPrimitive(value);
        // If accessing a key that doesn't already exist, and this node has been activated with extra keys
        // then return the values that were set. This is used by enableLegendStateReact for example.
        if (value === undefined || value === null || isValuePrimitive) {
            if (extraPrimitiveProps.size && (node.isActivatedPrimitive || extraPrimitiveActivators.has(p))) {
                node.isActivatedPrimitive = true;
                const vPrim = extraPrimitiveProps.get(p);
                if (vPrim !== undefined) {
                    return isFunction(vPrim) ? vPrim(getProxy(node)) : vPrim;
                }
            }
        }
        // /TODOV3 Remove this
        const vProp = value === null || value === void 0 ? void 0 : value[p];
        if (isObject(value) && value[symbolOpaque]) {
            return vProp;
        }
        // Handle function calls
        if (isFunction(vProp)) {
            if (isArray(value)) {
                if (ArrayModifiers.has(p)) {
                    // Call the wrapped modifier function
                    return (...args) => collectionSetter(node, value, p, ...args);
                }
                else if (ArrayLoopers.has(p)) {
                    // Update that this node was accessed for observers
                    updateTracking(node);
                    return function (cbOrig, thisArg) {
                        // If callback needs to run on the observable proxies, use a wrapped callback
                        function cbWrapped(_, index, array) {
                            return cbOrig(getProxy(node, index + ''), index, array);
                        }
                        // If return value needs to be observable proxies, use our own looping logic and return the proxy when found
                        if (ArrayLoopersReturn.has(p)) {
                            const isFind = p === 'find';
                            const out = [];
                            for (let i = 0; i < value.length; i++) {
                                if (cbWrapped(value[i], i, value)) {
                                    const proxy = getProxy(node, i + '');
                                    if (isFind) {
                                        return proxy;
                                    }
                                    else {
                                        out.push(proxy);
                                    }
                                }
                            }
                            return isFind ? undefined : out;
                        }
                        else {
                            return value[p](cbWrapped, thisArg);
                        }
                    };
                }
            }
            // Return the function bound to the value
            return vProp.bind(value);
        }
        // Accessing primitive returns the raw value
        if (isPrimitive(vProp)) {
            // Update that this primitive node was accessed for observers
            if (isArray(value) && p === 'length') {
                updateTracking(node, true);
                // } else if (!isPrimitive(value)) {
                //     updateTracking(getChildNode(node, p));
                return vProp;
            }
        }
        const fnOrComputed = (_a = node.functions) === null || _a === void 0 ? void 0 : _a.get(p);
        if (fnOrComputed) {
            return fnOrComputed;
        }
        // TODOV3: Remove "state"
        if (vProp === undefined && (p === 'state' || p === '_state') && node.state) {
            return node.state;
        }
        // Return an observable proxy to the property
        return getProxy(node, p);
    },
    // Forward all proxy properties to the target's value
    getPrototypeOf(node) {
        const value = getNodeValue(node);
        return value !== null && typeof value === 'object' ? Reflect.getPrototypeOf(value) : null;
    },
    ownKeys(node) {
        const value = getNodeValue(node);
        if (isPrimitive(value))
            return [];
        const keys = value ? Reflect.ownKeys(value) : [];
        // Update that this node was accessed for observers
        updateTracking(node, true);
        // This is required to fix this error:
        // TypeError: 'getOwnPropertyDescriptor' on proxy: trap reported non-configurability for
        // property 'length' which is either non-existent or configurable in the proxy node
        if (isArray(value) && keys[keys.length - 1] === 'length') {
            keys.splice(keys.length - 1, 1);
        }
        return keys;
    },
    getOwnPropertyDescriptor(node, prop) {
        const value = getNodeValue(node);
        return !isPrimitive(value) ? Reflect.getOwnPropertyDescriptor(value, prop) : undefined;
    },
    set(node, prop, value) {
        // If this assignment comes from within an observable function it's allowed
        if (node.isSetting) {
            return Reflect.set(node, prop, value);
        }
        if (node.isAssigning) {
            setKey(node, prop, value);
            return true;
        }
        const property = observableProperties.get(prop);
        if (property) {
            property.set(node, value);
            return true;
        }
        if (process.env.NODE_ENV === 'development') {
            console.warn('[legend-state]: Error: Cannot set a value directly:', prop, value);
        }
        return false;
    },
    deleteProperty(node, prop) {
        // If this delete comes from within an observable function it's allowed
        if (node.isSetting) {
            return Reflect.deleteProperty(node, prop);
        }
        else {
            if (process.env.NODE_ENV === 'development') {
                console.warn('[legend-state]: Error: Cannot delete a value directly:', prop);
            }
            return false;
        }
    },
    has(node, prop) {
        const value = getNodeValue(node);
        return Reflect.has(value, prop);
    },
};
function set(node, newValue) {
    if (node.parent) {
        return setKey(node.parent, node.key, newValue);
    }
    else {
        return setKey(node, '_', newValue);
    }
}
function toggle(node) {
    const value = getNodeValue(node);
    if (value === undefined || isBoolean(value)) {
        set(node, !value);
        return !value;
    }
    else if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        throw new Error('[legend-state] Cannot toggle a non-boolean value');
    }
}
function setKey(node, key, newValue, level) {
    if (process.env.NODE_ENV === 'development') {
        if (typeof HTMLElement !== 'undefined' && newValue instanceof HTMLElement) {
            console.warn(`[legend-state] Set an HTMLElement into state. You probably don't want to do that.`);
        }
    }
    if (node.root.locked && !node.root.set) {
        // This happens when modifying a locked observable such as a computed.
        // If merging this could be happening deep in a hierarchy so we don't want to throw errors so we'll just do nothing.
        // This could happen during persistence local load for example.
        if (globalState.isMerging) {
            return;
        }
        else {
            throw new Error(process.env.NODE_ENV === 'development'
                ? '[legend-state] Cannot modify an observable while it is locked. Please make sure that you unlock the observable before making changes.'
                : '[legend-state] Modified locked observable');
        }
    }
    const isRoot = !node.parent && key === '_';
    // Get the child node for updating and notifying
    const childNode = isRoot ? node : getChildNode(node, key);
    // Set the raw value on the parent object
    const { newValue: savedValue, prevValue, parentValue } = setNodeValue(childNode, newValue);
    const isFunc = isFunction(savedValue);
    const isPrim = isPrimitive(savedValue) || savedValue instanceof Date;
    if (savedValue !== prevValue) {
        updateNodesAndNotify(node, savedValue, prevValue, childNode, isPrim, isRoot, level);
    }
    extractFunctionOrComputed(node, parentValue, key, savedValue);
    return isFunc ? savedValue : isRoot ? getProxy(node) : getProxy(node, key);
}
function assign(node, value) {
    const proxy = getProxy(node);
    beginBatch();
    if (isPrimitive(node.root._)) {
        node.root._ = {};
    }
    // Set inAssign to allow setting on safe observables
    node.isAssigning = (node.isAssigning || 0) + 1;
    try {
        Object.assign(proxy, value);
    }
    finally {
        node.isAssigning--;
    }
    endBatch();
    return proxy;
}
function deleteFn(node, key) {
    // If called without a key, delete by key from the parent node
    if (key === undefined && isChildNodeValue(node)) {
        key = node.key;
        node = node.parent;
    }
    setKey(node, key !== null && key !== void 0 ? key : '_', symbolDelete, /*level*/ -1);
}
function handlerMapSet(node, p, value) {
    const vProp = value === null || value === void 0 ? void 0 : value[p];
    if (p === 'size') {
        return getProxy(node, p);
    }
    else if (isFunction(vProp)) {
        return function (a, b, c) {
            const l = arguments.length;
            const valueMap = value;
            if (p === 'get') {
                if (l > 0 && typeof a !== 'boolean' && a !== optimized) {
                    return getProxy(node, a);
                }
            }
            else if (p === 'set') {
                if (l === 2) {
                    const prev = valueMap.get(a);
                    const ret = valueMap.set(a, b);
                    if (prev !== b) {
                        updateNodesAndNotify(getChildNode(node, a), b, prev);
                    }
                    return ret;
                }
            }
            else if (p === 'delete') {
                if (l > 0) {
                    // Support Set by just returning a if it doesn't have get, meaning it's not a Map
                    const prev = value.get ? valueMap.get(a) : a;
                    const ret = value.delete(a);
                    if (ret) {
                        updateNodesAndNotify(getChildNode(node, a), undefined, prev);
                    }
                    return ret;
                }
            }
            else if (p === 'clear') {
                const prev = new Map(valueMap);
                const size = valueMap.size;
                valueMap.clear();
                if (size) {
                    updateNodesAndNotify(node, value, prev);
                }
                return;
            }
            else if (p === 'add') {
                const prev = new Set(value);
                const ret = value.add(a);
                if (!value.has(p)) {
                    notify(node, ret, prev, 0);
                }
                return ret;
            }
            // TODO: This is duplicated from proxy handler, how to dedupe with best performance?
            const fn = observableFns.get(p);
            if (fn) {
                // Array call and apply are slow so micro-optimize this hot path.
                // The observable functions depends on the number of arguments so we have to
                // call it with the correct arguments, not just undefined
                switch (l) {
                    case 0:
                        return fn(node);
                    case 1:
                        return fn(node, a);
                    case 2:
                        return fn(node, a, b);
                    default:
                        return fn(node, a, b, c);
                }
            }
            else {
                return value[p](a, b);
            }
        };
    }
}
function updateNodesAndNotify(node, newValue, prevValue, childNode, isPrim, isRoot, level) {
    if (!childNode)
        childNode = node;
    // Make sure we don't call too many listeners for ever property set
    beginBatch();
    if (isPrim === undefined) {
        isPrim = isPrimitive(newValue);
    }
    let hasADiff = isPrim;
    let whenOptimizedOnlyIf = false;
    // If new value is an object or array update notify down the tree
    if (!isPrim || (prevValue && !isPrimitive(prevValue))) {
        if ((process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
            typeof __devUpdateNodes !== 'undefined') {
            __devUpdateNodes.clear();
        }
        hasADiff = updateNodes(childNode, newValue, prevValue);
        if (isArray(newValue)) {
            whenOptimizedOnlyIf = (newValue === null || newValue === void 0 ? void 0 : newValue.length) !== (prevValue === null || prevValue === void 0 ? void 0 : prevValue.length);
        }
    }
    if (isPrim || !newValue || (isEmpty(newValue) && !isEmpty(prevValue)) ? newValue !== prevValue : hasADiff) {
        // Notify for this element if something inside it has changed
        notify(isPrim && isRoot ? node : childNode, newValue, prevValue, (level !== null && level !== void 0 ? level : prevValue === undefined) ? -1 : hasADiff ? 0 : 1, whenOptimizedOnlyIf);
    }
    endBatch();
}
function extractPromise(node, value) {
    if (!node.state) {
        node.state = createObservable({
            isLoaded: false,
        }, false, getProxy);
    }
    value
        .then((value) => {
        set(node, value);
        node.state.isLoaded.set(true);
    })
        .catch((error) => {
        node.state.error.set(error);
    });
}
function extractFunctionOrComputed(node, obj, k, v) {
    if (isPromise(v)) {
        extractPromise(getChildNode(node, k), v);
    }
    else if (typeof v === 'function') {
        extractFunction(node, k, v);
    }
    else if (typeof v == 'object' && v !== null && v !== undefined) {
        const childNode = getNode(v);
        if (childNode === null || childNode === void 0 ? void 0 : childNode.isComputed) {
            extractFunction(node, k, v, childNode);
            delete obj[k];
        }
        else {
            return true;
        }
    }
}
function get(node, options) {
    const track = options ? (isObject(options) ? options.shallow : options) : undefined;
    // Track by default
    updateTracking(node, track);
    return peek(node);
}
function peek(node) {
    const value = getNodeValue(node);
    // If node is not yet lazily computed go do that
    if (node.lazy) {
        delete node.lazy;
        for (const key in value) {
            if (hasOwnProperty.call(value, key)) {
                extractFunctionOrComputed(node, value, key, value[key]);
            }
        }
    }
    // Check if computed needs to activate
    checkActivate(node);
    return value;
}

const fns = ['get', 'set', 'peek', 'onChange', 'toggle'];
function ObservablePrimitiveClass(node) {
    this._node = node;
    // Bind to this
    for (let i = 0; i < fns.length; i++) {
        const key = fns[i];
        this[key] = this[key].bind(this);
    }
}
// Add observable functions to prototype
function proto(key, fn) {
    ObservablePrimitiveClass.prototype[key] = function (...args) {
        return fn.call(this, this._node, ...args);
    };
}
proto('peek', peek);
proto('get', get);
proto('set', set);
proto('onChange', onChange);
// Getters
Object.defineProperty(ObservablePrimitiveClass.prototype, symbolGetNode, {
    configurable: true,
    get() {
        return this._node;
    },
});
ObservablePrimitiveClass.prototype.toggle = function () {
    const value = this.peek();
    if (value === undefined || isBoolean(value)) {
        this.set(!value);
    }
    else if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        throw new Error('[legend-state] Cannot toggle a non-boolean value');
    }
    return !value;
};
ObservablePrimitiveClass.prototype.delete = function () {
    this.set(undefined);
    return this;
};

function observable(value) {
    return createObservable(value, false, getProxy, ObservablePrimitiveClass);
}
function observablePrimitive(value) {
    return createObservable(value, true, getProxy, ObservablePrimitiveClass);
}

function setupTracking(nodes, update, noArgs, immediate) {
    let listeners = [];
    // Listen to tracked nodes
    nodes === null || nodes === void 0 ? void 0 : nodes.forEach((tracked) => {
        const { node, track } = tracked;
        listeners.push(onChange(node, update, { trackingType: track, immediate, noArgs }));
    });
    return () => {
        if (listeners) {
            for (let i = 0; i < listeners.length; i++) {
                listeners[i]();
            }
            listeners = undefined;
        }
    };
}

function trackSelector(selector, update, observeEvent, observeOptions, createResubscribe) {
    var _a;
    let dispose;
    let resubscribe;
    let updateFn = update;
    beginTracking();
    const value = selector ? computeSelector(selector, observeEvent, observeOptions === null || observeOptions === void 0 ? void 0 : observeOptions.fromComputed) : selector;
    const tracker = tracking.current;
    const nodes = tracker.nodes;
    endTracking();
    if ((process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && tracker && nodes) {
        (_a = tracker.traceListeners) === null || _a === void 0 ? void 0 : _a.call(tracker, nodes);
        if (tracker.traceUpdates) {
            updateFn = tracker.traceUpdates(update);
        }
        // Clear tracing so it doesn't leak to other components
        tracker.traceListeners = undefined;
        tracker.traceUpdates = undefined;
    }
    if (!(observeEvent === null || observeEvent === void 0 ? void 0 : observeEvent.cancel)) {
        // Do tracing if it was requested
        // useSyncExternalStore doesn't subscribe until after the component mount.
        // We want to subscribe immediately so we don't miss any updates
        dispose = setupTracking(nodes, updateFn, false, observeOptions === null || observeOptions === void 0 ? void 0 : observeOptions.immediate);
        if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
            resubscribe = createResubscribe
                ? () => {
                    dispose === null || dispose === void 0 ? void 0 : dispose();
                    dispose = setupTracking(nodes, updateFn);
                    return dispose;
                }
                : undefined;
        }
    }
    return { value, dispose, resubscribe };
}

function observe(selectorOrRun, reactionOrOptions, options) {
    let reaction;
    if (isFunction(reactionOrOptions)) {
        reaction = reactionOrOptions;
    }
    else {
        options = reactionOrOptions;
    }
    let dispose;
    const e = { num: 0 };
    // Wrap it in a function so it doesn't pass all the arguments to run()
    const update = function () {
        if (e.onCleanup) {
            e.onCleanup();
            e.onCleanup = undefined;
        }
        // Run in a batch so changes don't happen until we're done tracking here
        beginBatch();
        // Run the function/selector
        delete e.value;
        // Dispose listeners from previous run
        dispose === null || dispose === void 0 ? void 0 : dispose();
        const { dispose: _dispose, value } = trackSelector(selectorOrRun, update, e, options);
        dispose = _dispose;
        e.value = value;
        if (e.onCleanupReaction) {
            e.onCleanupReaction();
            e.onCleanupReaction = undefined;
        }
        endBatch();
        // Call the reaction if there is one and the value changed
        if (reaction &&
            (e.num > 0 || !isEvent(selectorOrRun)) &&
            (e.previous !== e.value || (options === null || options === void 0 ? void 0 : options.fromComputed) || typeof e.value === 'object')) {
            reaction(e);
        }
        // Update the previous value
        e.previous = e.value;
        // Increment the counter
        e.num++;
    };
    update();
    // Return function calling dispose because dispose may be changed in update()
    return () => {
        var _a, _b;
        (_a = e.onCleanup) === null || _a === void 0 ? void 0 : _a.call(e);
        e.onCleanup = undefined;
        (_b = e.onCleanupReaction) === null || _b === void 0 ? void 0 : _b.call(e);
        e.onCleanupReaction = undefined;
        dispose === null || dispose === void 0 ? void 0 : dispose();
    };
}

function computed(compute, set$1) {
    // Create an observable for this computed variable
    const obs = observable();
    lockObservable(obs, true);
    const node = getNode(obs);
    node.isComputed = true;
    let isSetAfterActivated = false;
    const setInner = function (val) {
        const prevNode = node.linkedToNode;
        // If it was previously linked to a node remove self
        // from its linkedFromNodes
        if (prevNode) {
            prevNode.linkedFromNodes.delete(node);
            node.linkedToNode = undefined;
        }
        const { parentOther } = node;
        if (isObservable(val)) {
            // If the computed is a proxy to another observable
            // link it to the target observable
            const linkedNode = getNode(val);
            node.linkedToNode = linkedNode;
            if (!linkedNode.linkedFromNodes) {
                linkedNode.linkedFromNodes = new Set();
            }
            linkedNode.linkedFromNodes.add(node);
            if (node.parentOther) {
                onChange(linkedNode, ({ value }) => {
                    setNodeValue(node.parentOther, value);
                }, { initial: true });
            }
            // If the target observable is different then notify for the change
            if (prevNode) {
                const value = getNodeValue(linkedNode);
                const prevValue = getNodeValue(prevNode);
                notify(node, value, prevValue, 0);
            }
        }
        else if (val !== obs.peek()) {
            // Unlock computed node before setting the value
            lockObservable(obs, false);
            const setter = isSetAfterActivated ? set : setNodeValue;
            // Update the computed value
            setter(node, val);
            // If the computed is a child of an observable set the value on it
            if (parentOther) {
                let didUnlock = false;
                if (parentOther.root.locked) {
                    parentOther.root.locked = false;
                    didUnlock = true;
                }
                setter(parentOther, val);
                if (didUnlock) {
                    parentOther.root.locked = true;
                }
            }
            // Re-lock the computed node
            lockObservable(obs, true);
        }
        else if (parentOther) {
            setNodeValue(parentOther, val);
        }
        isSetAfterActivated = true;
    };
    // Lazily activate the observable when get is called
    node.root.activate = () => {
        node.root.activate = undefined;
        observe(compute, ({ value }) => {
            if (isPromise(value)) {
                value.then((v) => setInner(v));
            }
            else {
                setInner(value);
            }
        }, { immediate: true, fromComputed: true });
    };
    if (set$1) {
        node.root.set = (value) => {
            batch(() => set$1(value));
        };
    }
    return obs;
}

function configureLegendState({ observableFunctions, observableProperties: observableProperties$1, }) {
    if (observableFunctions) {
        for (const key in observableFunctions) {
            const fn = observableFunctions[key];
            observableFns.set(key, fn);
            ObservablePrimitiveClass.prototype[key] = function (...args) {
                return fn.call(this, this._node, ...args);
            };
        }
    }
    if (observableProperties$1) {
        for (const key in observableProperties$1) {
            const fns = observableProperties$1[key];
            observableProperties.set(key, fns);
            Object.defineProperty(ObservablePrimitiveClass.prototype, key, {
                configurable: true,
                get() {
                    return fns.get.call(this, this._node);
                },
                set(value) {
                    return fns.set.call(this, this._node, value);
                },
            });
        }
    }
}

function event() {
    // event simply wraps around a number observable
    // which increments its value to dispatch change events
    const obs = observable(0);
    const node = getNode(obs);
    node.isEvent = true;
    return {
        fire: function () {
            // Notify increments the value so that the observable changes
            obs.set((v) => v + 1);
        },
        on: function (cb) {
            return obs.onChange(cb);
        },
        get: function () {
            // Return the value so that when will be truthy
            return obs.get();
        },
        // @ts-expect-error eslint doesn't like adding symbols to the object but this does work
        [symbolGetNode]: node,
    };
}

function proxy(get, set) {
    // Create an observable for this computed variable
    const obs = observable({});
    lockObservable(obs, true);
    const mapTargets = new Map();
    const node = getNode(obs);
    node.isComputed = true;
    node.proxyFn = (key) => {
        let target = mapTargets.get(key);
        if (!target) {
            // Note: Coercing typescript to allow undefined for set in computed because we don't want the public interface to allow undefined
            target = computed(() => get(key), (set ? (value) => set(key, value) : undefined));
            mapTargets.set(key, target);
            extractFunction(node, key, target, getNode(target));
            if (node.parentOther) {
                onChange(getNode(target), ({ value, getPrevious }) => {
                    const previous = getPrevious();
                    // Set the raw value on the proxy's parent
                    setNodeValue(node.parentOther, node.root._);
                    // Notify the proxy
                    notify(getChildNode(node, key), value, previous, 0);
                });
            }
        }
        return target;
    };
    return obs;
}

function _when(predicate, effect, checkReady) {
    // If predicate is a regular Promise skip all the observable stuff
    if (isPromise(predicate)) {
        return effect ? predicate.then(effect) : predicate;
    }
    let value;
    // Create a wrapping fn that calls the effect if predicate returns true
    function run(e) {
        const ret = computeSelector(predicate);
        if (!isPromise(ret) && (checkReady ? isObservableValueReady(ret) : ret)) {
            value = ret;
            // Set cancel so that observe does not track anymore
            e.cancel = true;
        }
        return value;
    }
    function doEffect() {
        // If value is truthy then run the effect
        effect === null || effect === void 0 ? void 0 : effect(value);
    }
    // Run in an observe
    observe(run, doEffect);
    // If first run resulted in a truthy value just return it.
    // It will have set e.cancel so no need to dispose
    if (isPromise(value)) {
        return effect ? value.then(effect) : value;
    }
    else if (value !== undefined) {
        return Promise.resolve(value);
    }
    else {
        // Wrap it in a promise
        const promise = new Promise((resolve) => {
            if (effect) {
                const originalEffect = effect;
                effect = (value) => {
                    const effectValue = originalEffect(value);
                    resolve(effectValue);
                };
            }
            else {
                effect = resolve;
            }
        });
        return promise;
    }
}
function when(predicate, effect) {
    return _when(predicate, effect, false);
}
function whenReady(predicate, effect) {
    return _when(predicate, effect, true);
}

const internal = {
    clone,
    ensureNodeValue,
    findIDKey,
    get,
    getNode,
    getPathType,
    getProxy,
    globalState,
    initializePathType,
    observableFns,
    optimized,
    peek,
    safeParse,
    safeStringify,
    set,
    setAtPath,
    setNodeValue,
    symbolDelete,
};

exports.ObservablePrimitiveClass = ObservablePrimitiveClass;
exports.batch = batch;
exports.beginBatch = beginBatch;
exports.beginTracking = beginTracking;
exports.checkActivate = checkActivate;
exports.computeSelector = computeSelector;
exports.computed = computed;
exports.configureLegendState = configureLegendState;
exports.constructObjectWithPath = constructObjectWithPath;
exports.deconstructObjectWithPath = deconstructObjectWithPath;
exports.endBatch = endBatch;
exports.endTracking = endTracking;
exports.event = event;
exports.extraPrimitiveActivators = extraPrimitiveActivators;
exports.extraPrimitiveProps = extraPrimitiveProps;
exports.findIDKey = findIDKey;
exports.getNode = getNode;
exports.getNodeValue = getNodeValue;
exports.getObservableIndex = getObservableIndex;
exports.hasOwnProperty = hasOwnProperty;
exports.internal = internal;
exports.isArray = isArray;
exports.isBoolean = isBoolean;
exports.isEmpty = isEmpty;
exports.isFunction = isFunction;
exports.isObject = isObject;
exports.isObservable = isObservable;
exports.isObservableValueReady = isObservableValueReady;
exports.isPrimitive = isPrimitive;
exports.isPromise = isPromise;
exports.isString = isString;
exports.isSymbol = isSymbol;
exports.lockObservable = lockObservable;
exports.mergeIntoObservable = mergeIntoObservable;
exports.observable = observable;
exports.observablePrimitive = observablePrimitive;
exports.observe = observe;
exports.opaqueObject = opaqueObject;
exports.optimized = optimized;
exports.proxy = proxy;
exports.setAtPath = setAtPath;
exports.setInObservableAtPath = setInObservableAtPath;
exports.setSilently = setSilently;
exports.setupTracking = setupTracking;
exports.symbolDelete = symbolDelete;
exports.trackSelector = trackSelector;
exports.tracking = tracking;
exports.updateTracking = updateTracking;
exports.when = when;
exports.whenReady = whenReady;
//# sourceMappingURL=index.js.map
