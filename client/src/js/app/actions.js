import { PUSH_STATE } from "./actionTypes";

export const pushState = state => ({
    type: PUSH_STATE,
    state
});
