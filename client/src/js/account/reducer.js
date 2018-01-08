/**
 * @module account/reducer
 */

import { GET_ACCOUNT, UPDATE_ACCOUNT_SETTINGS, CHANGE_ACCOUNT_PASSWORD, GET_API_KEYS } from "../actionTypes";

/**
 * The state that should initially be stored.
 *
 * @const
 * @type {object}
 */
const initialState = {
    ready: false,
    oldPasswordError: false,
    apiKeys: null
};

export default function accountReducer (state = initialState, action) {

    switch (action.type) {

        case GET_ACCOUNT.SUCCEEDED:
            return {...state, ...action.data, ready: true};

        case UPDATE_ACCOUNT_SETTINGS.SUCCEEDED:
            return {...state, settings: action.data};

        case CHANGE_ACCOUNT_PASSWORD.SUCCEEDED:
            return {...state, oldPasswordError: false};

        case CHANGE_ACCOUNT_PASSWORD.FAILED:
            if (action.message === "Invalid old password") {
                return {...state, oldPasswordError: true};
            }

            return state;


        case GET_API_KEYS.SUCCEEDED:
            return {...state, apiKeys: action.data};

        default:
            return state;
    }
}
