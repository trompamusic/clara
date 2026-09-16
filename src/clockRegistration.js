// MELD's REGISTER_CLOCK replaces the entire resource map, even when the clock
// already exists. Preserve registered clocks and their annotation/playback state.
export const withClockRegistration = (reducer) => (state, action) => {
  if (action.type !== "REGISTER_CLOCK") return reducer(state, action);

  const current = state ?? reducer(undefined, { type: "@@INIT" });
  if (Object.prototype.hasOwnProperty.call(current.mediaResources, action.payload))
    return current;

  return {
    ...current,
    mediaResources: {
      ...current.mediaResources,
      [action.payload]: { times: {}, currentTime: 0 },
    },
  };
};
