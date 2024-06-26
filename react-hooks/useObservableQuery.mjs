import { observable, observe } from '@legendapp/state';
import { QueryClient, MutationObserver, QueryObserver } from '@tanstack/query-core';
import { useQueryClient, useIsRestoring, useQueryErrorResetBoundary } from '@tanstack/react-query';
import * as React from 'react';

// This is basically just React Query's useBaseQuery with a few changes for Legend-State:
const ensurePreventErrorBoundaryRetry = (options, errorResetBoundary) => {
    if (options.suspense || options.throwOnError) {
        // Prevent retrying failed query if the error boundary has not been reset yet
        if (!errorResetBoundary.isReset()) {
            options.retryOnMount = false;
        }
    }
};
const useClearResetErrorBoundary = (errorResetBoundary) => {
    React.useEffect(() => {
        errorResetBoundary.clearReset();
    }, [errorResetBoundary]);
};
function shouldThrowError(_throwOnError, params) {
    // Allow _throwOnError function to override throwing behavior on a per-error basis
    if (typeof _throwOnError === 'function') {
        return _throwOnError(...params);
    }
    return !!_throwOnError;
}
const getHasError = ({ result, errorResetBoundary, throwOnError, query, }) => {
    return (result.isError &&
        !errorResetBoundary.isReset() &&
        !result.isFetching &&
        shouldThrowError(throwOnError, [result.error, query]));
};
function useObservableQuery(options, mutationOptions) {
    const Observer = QueryObserver;
    const queryClient = (options === null || options === void 0 ? void 0 : options.queryClient) || useQueryClient(new QueryClient());
    const isRestoring = useIsRestoring();
    const errorResetBoundary = useQueryErrorResetBoundary();
    const defaultedOptions = queryClient.defaultQueryOptions(options);
    // Make sure results are optimistically set in fetching state before subscribing or updating options
    defaultedOptions._optimisticResults = isRestoring ? 'isRestoring' : 'optimistic';
    if (defaultedOptions.suspense) {
        // Always set stale time when using suspense to prevent
        // fetching again when directly mounting after suspending
        if (typeof defaultedOptions.staleTime !== 'number') {
            defaultedOptions.staleTime = 1000;
        }
    }
    ensurePreventErrorBoundaryRetry(defaultedOptions, errorResetBoundary);
    useClearResetErrorBoundary(errorResetBoundary);
    const [observer] = React.useState(() => new Observer(queryClient, defaultedOptions));
    const result = observer.getOptimisticResult(defaultedOptions);
    // useSyncExternalStore was here in useBaseQuery but is removed for Legend-State.
    React.useEffect(() => {
        // Do not notify on updates because of changes in the options because
        // these changes should already be reflected in the optimistic result.
        observer.setOptions(defaultedOptions, { listeners: false });
    }, [defaultedOptions, observer]);
    // Handle suspense
    if (defaultedOptions.suspense && result.isLoading && result.isFetching && !isRestoring) {
        throw observer
            .fetchOptimistic(defaultedOptions)
            .then(() => {
            // defaultedOptions.onSuccess?.(data as TData);
            // defaultedOptions.onSettled?.(data, null);
        })
            .catch(() => {
            errorResetBoundary.clearReset();
            // defaultedOptions.onError?.(error);
            // defaultedOptions.onSettled?.(undefined, error);
        });
    }
    // Handle error boundary
    if (getHasError({
        result,
        errorResetBoundary,
        throwOnError: defaultedOptions.throwOnError,
        query: observer.getCurrentQuery(),
    })) {
        throw result.error;
    }
    // Legend-State changes from here down
    let mutator;
    if (mutationOptions) {
        [mutator] = React.useState(() => new MutationObserver(queryClient, mutationOptions));
    }
    const [obs] = React.useState(() => {
        const obs = observable(observer.getCurrentResult());
        let isSetting = false;
        // If there is a mutator watch for changes as long as they don't come from the the query observer
        if (mutationOptions) {
            observe(() => {
                const data = obs.data.get();
                // Don't want to call mutate if there's no data or this coming from the query changing
                if (data && !isSetting) {
                    mutator.mutate(data);
                }
            });
        }
        // Note: Don't need to worry about unsubscribing because the query observer itself
        // is scoped to this component
        observer.subscribe((result) => {
            isSetting = true;
            try {
                // Update the observable with the latest value
                obs.set(result);
            }
            finally {
                // If set causes a crash for some reason we still need to reset isSetting
                isSetting = false;
            }
        });
        return obs;
    });
    // Return the observable
    return obs;
}

export { useObservableQuery };
//# sourceMappingURL=useObservableQuery.mjs.map
