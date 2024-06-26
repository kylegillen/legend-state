import { observable, internal, constructObjectWithPath, mergeIntoObservable } from '@legendapp/state';

function trackHistory(obs, targetObservable) {
    const history = targetObservable !== null && targetObservable !== void 0 ? targetObservable : observable();
    obs.onChange(({ changes }) => {
        // Don't save history if this is a remote change.
        // History will be saved remotely by the client making the local change.
        if (!internal.globalState.isLoadingRemote && !internal.globalState.isLoadingLocal) {
            const time = Date.now().toString();
            // Save to history observable by date, with the previous value
            for (let i = 0; i < changes.length; i++) {
                const { path, prevAtPath, pathTypes } = changes[i];
                const obj = constructObjectWithPath(path, pathTypes, prevAtPath);
                mergeIntoObservable(history[time], obj);
            }
        }
    });
    return history;
}

export { trackHistory };
//# sourceMappingURL=history.mjs.map
