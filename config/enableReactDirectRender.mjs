import { isObservable, getNode, extraPrimitiveActivators, ObservablePrimitiveClass, extraPrimitiveProps } from '@legendapp/state';
import { useSelector } from '@legendapp/state/react';
import { memo, createElement } from 'react';

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
        const Text = memo(function Text({ data }) {
            if (process.env.NODE_ENV === 'development') {
                if (isObservable(data)) {
                    console.warn(`[legend-state] enableReactDirectRender is deprecated and will be removed in version 3.0. Please convert rendering of observable with path ${getNodePath(getNode(data))} to <Memo>{value}</Memo>. See https://legendapp.com/open-source/state/migrating for more details.`);
                }
            }
            return useSelector(data);
        });
        const ReactTypeofSymbol = hasSymbol ? Symbol.for('react.element') : createElement('a').$$typeof;
        const s = extraPrimitiveProps;
        const proto = {};
        // Set up activators to activate this node as being used in React
        extraPrimitiveActivators.set('$$typeof', true);
        extraPrimitiveActivators.set(Symbol.toPrimitive, true);
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
        Object.defineProperties(ObservablePrimitiveClass.prototype, proto);
    }
}

export { enableReactDirectRender, hasSymbol };
//# sourceMappingURL=enableReactDirectRender.mjs.map
