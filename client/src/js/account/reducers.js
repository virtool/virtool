/**
 * Redux reducer for working with the logged in user's account data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign } from "lodash";
import { GET_ACCOUNT, UPDATE_ACCOUNT_SETTINGS, CHANGE_ACCOUNT_PASSWORD, GET_API_KEYS, LOGOUT } from "../actionTypes";

const initialState = {
    ready: false,
    oldPasswordError: false,
    apiKeys: null
};

export default function accountReducer (state = initialState, action) {

    switch (action.type) {

        case GET_ACCOUNT.SUCCEEDED:
            return assign({}, state, action.data, {ready: true});
            
        case UPDATE_ACCOUNT_SETTINGS.SUCCEEDED:
            return assign({}, state, {settings: action.data});

        case CHANGE_ACCOUNT_PASSWORD.SUCCEEDED:
            return assign({}, state, {oldPasswordError: false});

        case CHANGE_ACCOUNT_PASSWORD.FAILED:
            return assign({}, state, {oldPasswordError: true});

        case GET_API_KEYS.SUCCEEDED:
            return assign({}, state, {apiKeys: action.data});

        default:
            return state;
    }
}
