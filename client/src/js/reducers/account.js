/**
 * Redux reducer for working with the logged in user's account data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign } from "lodash";
import { GET_ACCOUNT_SUCCEEDED } from "../actions/actionTypes";

const initialState = {
    user_id: null,
    groups: null,
    permissions: null,
    settings: null
};

export function accountReducer (state = initialState, action) {

    switch (action.type) {

        case GET_ACCOUNT_SUCCEEDED:
            return assign({}, state, action.data);

        default:
            return state;
    }
}
