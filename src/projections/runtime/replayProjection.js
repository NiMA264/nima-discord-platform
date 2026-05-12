function replayProjection(events, projection, initialState) {
    const list = Array.isArray(events) ? events : [];
    const apply = typeof projection === 'function' ? projection : (state) => state;
    const seed = initialState === undefined ? {} : initialState;
    return list.reduce((state, event) => apply(state, event), seed);
}

module.exports = {
    replayProjection
};
