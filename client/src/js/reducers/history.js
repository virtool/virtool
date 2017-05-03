/**
 * Redux reducers for working with virus history data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign } from "lodash";
import { LOAD_VIRUSES, UPDATE_VIRUS, REMOVE_VIRUS } from "../actions/actionTypes";

const initialState = {
    history: [],
    filter: null,
    page: 1
};

export function historyReducer(state = initialState, action) {
    switch (action.type) {
        case LOAD_HISTORY:
            return assign({}, state, {
                viruses: action.viruses
            });

        default:
            return state;
    }
}
