/**
 * Redux reducer for working with the logged in user's account data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign } from "lodash";
import { LIST_USERS, SELECT_USER, CHANGE_SET_PASSWORD, CLEAR_SET_PASSWORD, SET_FORCE_RESET } from "../../actionTypes";

const initialState = {
    list: null,
    activeId: null,
    activeData: null,

    password: "",
    confirm: "",
    passwordChangeFailed: false,
    passwordChangePending: false,

    setForceResetPending: false
};

const reducer = (state = initialState, action) => {

    switch (action.type) {

        case LIST_USERS.REQUESTED:
            return assign({}, state);

        case LIST_USERS.SUCCEEDED:
            return assign({}, state, {
                list: action.users,
                activeId: action.users[0] || null
            });

        case SELECT_USER.REQUESTED:
            return assign({}, state, {
                activeId: action.userId,
                activeData: null,
                password: "",
                confirm: "",
                passwordChangeFailed: false,
                passwordChangePending: false,
                setForceResetPending: false
            });

        case SELECT_USER.SUCCEEDED:
            return assign({}, state, {
                activeData: action.data
            });

        case CHANGE_SET_PASSWORD:
            return assign({}, state, {
                password: action.password,
                confirm: action.confirm
            });

        case CLEAR_SET_PASSWORD:
            return assign({}, state, {
                password: "",
                confirm: ""
            });

        case SET_FORCE_RESET.REQUESTED:
            return assign({}, state, {
                forceResetChangePending: true
            });

        case SET_FORCE_RESET.SUCCEEDED:
            return assign({}, state, {
                forceResetChangePending: false,
                activeData: action.data
            });

        default:
            return state;
    }

};

export default reducer;
