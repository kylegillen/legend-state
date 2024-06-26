import { persistObservable } from '@legendapp/state/persist';
import { useMemo } from 'react';

/**
 * A React hook that creates a new observable and can optionally listen or persist its state.
 *
 * @param initialValue The initial value of the observable or a function that returns the initial value
 * @param options Persistence options for the observable
 *
 * @see https://www.legendapp.com/dev/state/react/#useObservable
 */
function usePersistedObservable(initialValue, options) {
    // Create the observable from the default value
    return useMemo(() => {
        return persistObservable(initialValue, options);
    }, []);
}

export { usePersistedObservable };
//# sourceMappingURL=usePersistedObservable.mjs.map
