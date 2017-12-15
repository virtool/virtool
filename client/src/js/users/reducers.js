/**
 * Redux reducer for working with the logged in user's account data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import {
    LIST_USERS,
    FILTER_USERS,
    CREATE_USER,
    SET_PASSWORD,
    SET_FORCE_RESET,
    SET_PRIMARY_GROUP,
    ADD_USER_TO_GROUP,
    REMOVE_USER_FROM_GROUP
} from "../actionTypes";

const initialState = {
    list: null,
    filter: "",

    createPending: false,
    createError: null
};

const updateUser = (state, update) => {
    return {...state, list: state.list.map(user => {
        if (user.id === update.id) {
            return {...user, ...update};
        }

        return user;
    })};
};

const reducer = (state = initialState, action) => {

    switch (action.type) {

        case LIST_USERS.SUCCEEDED: {
            const activeData = action.users[0];

            return {...state, list: action.users, activeId: activeData.id, activeData: activeData};
        }

        case FILTER_USERS: {
            return {...state, filter: action.term};
        }

        case CREATE_USER.SUCCEEDED:
        case SET_PASSWORD.SUCCEEDED:
        case SET_FORCE_RESET.SUCCEEDED:
        case SET_PRIMARY_GROUP.SUCCEEDED:
        case ADD_USER_TO_GROUP.SUCCEEDED:
        case REMOVE_USER_FROM_GROUP.SUCCEEDED: {
            return updateUser(state, action.data);
        }

        case CREATE_USER.REQUESTED:
            return {...state, createPending: true, createError: null};

        case CREATE_USER.FAILED:
            return {...state, createPending: false, createError: action.error};

        case SET_PASSWORD.REQUESTED: {
            return updateUser(state, {passwordPending: true, passwordError: null});
        }

        case SET_PASSWORD.FAILED:
            return updateUser(state, {...state, passwordPending: false, passwordError: action.error});

        case SET_FORCE_RESET.REQUESTED:
            return {...state, forceResetChangePending: true};

        default:
            return state;
    }

};

export default reducer;
