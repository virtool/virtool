/**
 * Redux reducers for working with virus data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign } from "lodash";
import { LOAD_VIRUSES, UPDATE_VIRUS, REMOVE_VIRUS } from "../actions/actionTypes";

const initialState = {
    viruses: []
};

function virus(state = initialState, action) {
    switch (action.type) {
        case LOAD_VIRUSES:
            return assign({}, state, {
                viruses: action.viruses
            });

        default:
            return state;
    }
}
