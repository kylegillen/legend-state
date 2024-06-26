'use strict';

var state = require('@legendapp/state');
var Router = require('next/router');

function isShallowEqual(query1, query2) {
    if (!query1 !== !query2) {
        return false;
    }
    const keys1 = Object.keys(query1);
    const keys2 = Object.keys(query2);
    if (keys1.length !== keys2.length) {
        return false;
    }
    for (const key of keys1) {
        if (query1[key] !== query2[key]) {
            return false;
        }
    }
    return true;
}
const routes$ = state.observable({});
let routeParams = {};
let router;
routes$.onChange(({ value, getPrevious }) => {
    // Only run this if being manually changed by the user
    let setter = routeParams === null || routeParams === void 0 ? void 0 : routeParams.set;
    if (!setter) {
        if (value.pathname) {
            setter = () => value;
        }
        else {
            console.error('[legend-state]: Must provide a set method to useObservableNextRouter');
        }
    }
    const setReturn = setter(value, getPrevious(), router);
    const { pathname, hash, query } = setReturn;
    let { transitionOptions, method } = setReturn;
    method = method || (routeParams === null || routeParams === void 0 ? void 0 : routeParams.method);
    transitionOptions = transitionOptions || (routeParams === null || routeParams === void 0 ? void 0 : routeParams.transitionOptions);
    const prevHash = router.asPath.split('#')[1] || '';
    const change = {};
    // Only include changes that were meant to be changed. For example the user may have
    // only changed the hash so we don't need to push a pathname change.
    if (pathname !== undefined && pathname !== router.pathname) {
        change.pathname = pathname;
    }
    if (hash !== undefined && hash !== prevHash) {
        change.hash = hash;
    }
    if (query !== undefined && !isShallowEqual(query, router.query)) {
        change.query = query;
    }
    // Only push if there are changes
    if (!state.isEmpty(change)) {
        const fn = method === 'replace' ? 'replace' : 'push';
        router[fn](change, undefined, transitionOptions).catch((e) => {
            // workaround for https://github.com/vercel/next.js/issues/37362
            if (!e.cancelled)
                throw e;
        });
    }
});
function useObservableNextRouter(params) {
    const { subscribe, compute } = params || {};
    try {
        // Use the useRouter hook if we're on the client side and want to subscribe to changes.
        // Otherwise use the Router object so that this does not subscribe to router changes.
        router = typeof window !== 'undefined' && !subscribe ? Router : Router.useRouter();
    }
    finally {
        router = router || Router.useRouter();
    }
    // Update the local state with the new functions and options. This can happen when being run
    // on a new page or if the user just changes it on the current page.
    // It's better for performance than creating new observables or hooks for every use, since there may be
    // many uses of useObservableRouter in the lifecycle of a page.
    routeParams = params;
    // Get the pathname and hash
    const { asPath, pathname, query } = router;
    const hash = asPath.split('#')[1] || '';
    // Run the compute function to get the value of the object
    const computeParams = { pathname, hash, query };
    const obj = compute ? compute(computeParams) : computeParams;
    // Set the object without triggering router.push
    state.setSilently(routes$, obj);
    // Return the observable with the computed values
    return routes$;
}

exports.useObservableNextRouter = useObservableNextRouter;
//# sourceMappingURL=useObservableNextRouter.js.map
