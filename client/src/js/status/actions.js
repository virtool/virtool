import { WS_UPDATE_STATUS } from "../actionTypes";

/**
 * Returns an action that should be dispatched when the status is updated via websocket.
 *
 * @func
 * @param data {object} the data passed in the websocket message
 * @returns {object}
 */
export const wsUpdateStatus = data => ({
    type: WS_UPDATE_STATUS,
    data
});
