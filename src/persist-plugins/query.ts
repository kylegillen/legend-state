import {
  ObservablePersistRemoteFunctions,
  isFunction,
  observe,
  type ObservablePersistRemoteSetParams,
} from '@legendapp/state';
import {
  InfiniteQueryObserver,
  MutationObserver,
  QueryClient,
  QueryKey,
  QueryObserver,
  UseBaseQueryOptions,
  UseMutationOptions,
  useQueryClient,
} from '@tanstack/react-query';

type ObservableQueryOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey extends QueryKey> = Omit<
  UseBaseQueryOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
  'queryKey'
> & { queryKey?: TQueryKey | (() => TQueryKey) };

type Params<TQueryFnData, TError, TData, TQueryData, TQueryKey extends QueryKey> = {
  query: ObservableQueryOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>;
  mutation?: UseMutationOptions<TData, TError, void>;
  type?: 'Query' | 'Infinite';
} & (
    | {
      queryClient: QueryClient;
      useContext?: false | undefined | never;
    }
    | {
      queryClient?: QueryClient;
      useContext?: true;
    }
  );

export function persistPluginQuery<TObs, TQueryFnData, TError, TData, TQueryData, TQueryKey extends QueryKey>({
  query: options,
  mutation: mutationOptions,
  type = 'Query',
  queryClient,
  useContext,
}: Params<TQueryFnData, TError, TData, TQueryData, TQueryKey>): ObservablePersistRemoteFunctions<TObs> {
  if (useContext) {
    queryClient = queryClient || useQueryClient();
  }
  // Set up the defaults like useBaseQuery does
  const defaultedOptions = queryClient!.defaultQueryOptions(
    options as UseBaseQueryOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
  );

  const Observer = type === 'Query' ? QueryObserver : (InfiniteQueryObserver as typeof QueryObserver);

  const ret: ObservablePersistRemoteFunctions<unknown> = {
    get({ onChange }) {
      let observer: QueryObserver<TQueryFnData, TError, TData, TQueryData, TQueryKey> | undefined = undefined;
      let latestOptions = defaultedOptions;
      let queryKeyFromFn: TQueryKey;

      const origQueryKey = options.queryKey!;

      // If the queryKey is a function, observe it and extract the raw value
      const isKeyFunction = isFunction(origQueryKey);
      if (isKeyFunction) {
        observe(({ num }) => {
          queryKeyFromFn = origQueryKey();
          if (num > 0) {
            updateQueryOptions(latestOptions);
          }
        });
      }

      const updateQueryOptions = (obj: any) => {
        // Since legend-state mutates the query options, we need to clone it to make Query
        // see it as changed
        const options = Object.assign({}, obj);

        // Use the latest value from the observed queryKey function
        if (isKeyFunction) {
          options.queryKey = queryKeyFromFn;
        }

        latestOptions = options;

        // Update the Query options
        if (observer) {
          observer.setOptions(options, { listeners: false });
        }
      };
      updateQueryOptions(defaultedOptions);

      // Create the observer
      observer = new Observer!<TQueryFnData, TError, TData, TQueryData, TQueryKey>(queryClient!, latestOptions);

      // Get the initial optimistic results if it's already cached
      const result = observer!.getOptimisticResult(latestOptions);
      // Subscribe to Query's observer and update the observable
      observer!.subscribe((result) => {
        onChange({ value: result.data });
      });

      // Return the initial data
      if (result) {
        return result.data;
      }
    },
  };

  if (mutationOptions) {
    const mutator = new MutationObserver(queryClient!, mutationOptions);
    // When the observable changes call the mutator function
    ret.set = async ({ value }: ObservablePersistRemoteSetParams<any>) => {
      mutator.mutate(value);
    };
  }

  return ret as any;
}
