import { getLocation } from "connected-react-router";
import { get } from "lodash-es";

export const getRouterLocationState = state => getLocation(state).state;

export const getRouterLocationStateValue = (state, key) => get(getRouterLocationState(state), key);
