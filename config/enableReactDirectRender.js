'use strict';

var state = require('@legendapp/state');
var react$1 = require('@legendapp/state/react');
var react = require('react');

// V3TODO: Remove this file
let isEnabled = false;
function getNodePath(node) {
    const arr = [];
    let n = node;
    while ((n === null || n === void 0 ? void 0 : n.key) !== undefined) {
        arr.splice(0, 0, n.key);
        n = n.parent;
    }
    return arr.join('.');
}
// Extracting the forwardRef inspired by https://github.com/mobxjs/mobx/blob/main/packages/mobx-react-lite/src/observer.ts
const hasSymbol =  typeof Symbol === 'function' && Symbol.for;
function enableReactDirectRender() {
    if (process.env.NODE_ENV === 'development') {
        console.warn('[legend-state] enableReactDirectRender is deprecated and will be removed in version 3.0. Please convert it from {value} to <Memo>{value}</Memo>. See https://legendapp.com/open-source/state/migrating for more details.');
    }
    if (!isEnabled) {
        isEnabled = true;
        // Rendering observables directly inspired by Preact Signals: https://github.com/preactjs/signals/blob/main/packages/react/src/index.ts
        // Add the extra primitive props so that observables can render directly
        // Memoized component to wrap the observable value
        const Text = react.memo(function Text({ data }) {
            if (process.env.NODE_ENV === 'development') {
                if (state.isObservable(data)) {
                    console.warn(`[legend-state] enableReactDirectRender is deprecated and will be removed in version 3.0. Please convert rendering of observable with path ${getNodePath(state.getNode(data))} to <Memo>{value}</Memo>. See https://legendapp.com/open-source/state/migrating for more details.`);
                }
            }
            return react$1.useSelector(data);
        });
        const ReactTypeofSymbol = hasSymbol ? Symbol.for('react.element') : react.createElement('a').$$typeof;
        const s = state.extraPrimitiveProps;
        const proto = {};
        // Set up activators to activate this node as being used in React
        state.extraPrimitiveActivators.set('$$typeof', true);
        state.extraPrimitiveActivators.set(Symbol.toPrimitive, true);
        // eslint-disable-next-line no-inner-declarations
        function set(key, value) {
            s.set(key, value);
            proto[key] = { configurable: true, value };
        }
        set('$$typeof', ReactTypeofSymbol);
        set('type', Text);
        set('_store', { validated: true });
        set('key', null);
        set('ref', null);
        set('alternate', null);
        set('_owner', null);
        set('_source', null);
        // Set extra props for the proxyHandler to return on primitives
        s.set(Symbol.toPrimitive, (_, value) => value);
        s.set('props', (obs) => ({ data: obs }));
        // Set extra props for ObservablePrimitive to return on primitives
        proto[Symbol.toPrimitive] = {
            configurable: true,
            get() {
                return this.peek();
            },
        };
        proto.props = {
            configurable: true,
            get() {
                return { data: this };
            },
        };
        Object.defineProperties(state.ObservablePrimitiveClass.prototype, proto);
    }
}

exports.enableReactDirectRender = enableReactDirectRender;
exports.hasSymbol = hasSymbol;
//# sourceMappingURL=enableReactDirectRender.js.map
