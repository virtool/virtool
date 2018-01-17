/**
 * Exports a reducer for dealing with the account of the session user.
 *
 * @module account/reducer
 */
import { GET_ACCOUNT, UPDATE_ACCOUNT_SETTINGS, CHANGE_ACCOUNT_PASSWORD, GET_API_KEYS } from "../actionTypes";
import { reportAPIError } from "../utils";

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

/**
 * A reducer for dealing with the account of the session user.
 *
 * @param state {object}
 * @param action {object}
 * @returns {object}
 */
export default function accountReducer (state = initialState, action) {

    switch (action.type) {

        case GET_ACCOUNT.SUCCEEDED:
            return {...state, ...action.data, ready: true};

        case UPDATE_ACCOUNT_SETTINGS.SUCCEEDED:
            return {...state, settings: action.data};

        case CHANGE_ACCOUNT_PASSWORD.SUCCEEDED:
            return {...state, oldPasswordError: false};

        case CHANGE_ACCOUNT_PASSWORD.FAILED:
            if (action.message === "Invalid old password.") {
                return {...state, oldPasswordError: true};
            }

            return reportAPIError(action);

        case GET_API_KEYS.SUCCEEDED:
            return {...state, apiKeys: action.data};

        default:
            return state;
    }
}
