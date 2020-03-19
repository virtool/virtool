import { get } from "lodash-es";

export const getError = (state, actionType) => get(state.errors, actionType);
