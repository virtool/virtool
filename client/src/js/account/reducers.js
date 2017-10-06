/**
 * Redux reducer for working with the logged in user's account data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign } from "lodash";
import { GET_ACCOUNT, UPDATE_ACCOUNT_SETTINGS, CHANGE_ACCOUNT_PASSWORD, LOGOUT } from "../actionTypes";

const initialState = {
    ready: false,
    oldPasswordError: false
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

        case LOGOUT.SUCCEEDED:
            window.location.reload();
            return state;

        default:
            return state;
    }
}
