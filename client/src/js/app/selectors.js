import { getLocation } from "connected-react-router";

export const getRouterLocationState = state => getLocation(state).state;
