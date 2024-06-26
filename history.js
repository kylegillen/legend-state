'use strict';

var state = require('@legendapp/state');

function trackHistory(obs, targetObservable) {
    const history = targetObservable !== null && targetObservable !== void 0 ? targetObservable : state.observable();
    obs.onChange(({ changes }) => {
        // Don't save history if this is a remote change.
        // History will be saved remotely by the client making the local change.
        if (!state.internal.globalState.isLoadingRemote && !state.internal.globalState.isLoadingLocal) {
            const time = Date.now().toString();
            // Save to history observable by date, with the previous value
            for (let i = 0; i < changes.length; i++) {
                const { path, prevAtPath, pathTypes } = changes[i];
                const obj = state.constructObjectWithPath(path, pathTypes, prevAtPath);
                state.mergeIntoObservable(history[time], obj);
            }
        }
    });
    return history;
}

exports.trackHistory = trackHistory;
//# sourceMappingURL=history.js.map
