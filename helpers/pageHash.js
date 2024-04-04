'use strict';

var state = require('@legendapp/state');

let _options = { setter: 'hash' };
function configurePageHash(options) {
    _options = options;
}
const hasWindow = typeof window !== 'undefined';
const pageHash = state.observable(hasWindow ? window.location.hash.slice(1) : '');
if (hasWindow) {
    let isSetting = false;
    // Set the page hash when the observable changes
    pageHash.onChange(({ value }) => {
        if (!isSetting) {
            const hash = '#' + value;
            const setter = (_options === null || _options === void 0 ? void 0 : _options.setter) || 'hash';
            if (setter === 'pushState') {
                history.pushState(null, null, hash);
            }
            else if (setter === 'replaceState') {
                history.replaceState(null, null, hash);
            }
            else {
                location.hash = hash;
            }
        }
    });
    // Update the observable whenever the hash changes
    const cb = () => {
        isSetting = true;
        pageHash.set(window.location.hash.slice(1));
        isSetting = false;
    };
    // Subscribe to window hashChange event
    window.addEventListener('hashchange', cb);
}

exports.configurePageHash = configurePageHash;
exports.pageHash = pageHash;
//# sourceMappingURL=pageHash.js.map
