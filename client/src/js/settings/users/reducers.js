/**
 * Redux reducer for working with the logged in user's account data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign, find, findIndex } from "lodash";
import {
    LIST_USERS,
    SELECT_USER,
    CHANGE_SET_PASSWORD,
    CHANGE_SET_CONFIRM,
    SET_PASSWORD,
    CLEAR_SET_PASSWORD,
    SET_FORCE_RESET,
    SET_PRIMARY_GROUP,
    ADD_USER_TO_GROUP,
    REMOVE_USER_FROM_GROUP
} from "../../actionTypes";

const updateActiveData = (state, updater) => {
    const newState = assign({}, state);

    const index = findIndex(state.list, {user_id: state.activeId});

    updater(newState.list[index]);

    return newState;
};

const initialState = {
    list: null,
    activeId: null,

    password: "",
    confirm: "",
    passwordError: "",
    passwordChangeFailed: false,
    passwordChangePending: false,

    setForceResetPending: false
};

const reducer = (state = initialState, action) => {

    switch (action.type) {

        case LIST_USERS.REQUESTED:
            return assign({}, state);

        case LIST_USERS.SUCCEEDED: {
            const activeData = action.users[0];

            return assign({}, state, {
                list: action.users,
                activeId: activeData.id,
                activeData: activeData
            });
        }

        case SELECT_USER:
            return assign({}, state, {
                activeId: action.userId,
                password: "",
                confirm: "",
                passwordChangeFailed: false,
                passwordChangePending: false,
                setForceResetPending: false
            });

        case CHANGE_SET_PASSWORD:
            return assign({}, state, {
                password: action.password
            });

        case CHANGE_SET_CONFIRM:
            return assign({}, state, {
                confirm: action.confirm
            });

        case CLEAR_SET_PASSWORD:
            return assign({}, state, {
                password: "",
                confirm: "",
                passwordError: ""
            });

        case SET_PASSWORD.REQUESTED: {
            return assign({}, state, {
                passwordChangePending: true
            });
        }

        case SET_PASSWORD.SUCCEEDED: {
            let newState = assign({}, state, {
                password: "",
                confirm: "",
                error: "",
                passwordChangePending: false
            });

            const index = findIndex(newState.list, {user_id: state.activeId});

            assign(newState.list[index], action.data);

            return newState;
        }

        case SET_PASSWORD.FAILED:
            return assign({}, state, {
                passwordError: action.error,
                passwordChangePending: false
            });

        case SET_FORCE_RESET.REQUESTED:
            return assign({}, state, {
                forceResetChangePending: true
            });

        case SET_FORCE_RESET.SUCCEEDED: {
            let newState = assign({}, state, {
                forceResetChangePending: false
            });

            const index = findIndex(newState.list, {user_id: state.activeId});

            assign(newState.list[index], action.data);

            return newState;
        }

        case SET_PRIMARY_GROUP.SUCCEEDED: {

            const newState = assign({}, state);

            const index = findIndex(state.list, {user_id: state.activeId});

            assign(newState.list[index], action.data);

            return newState;
        }

        case ADD_USER_TO_GROUP.SUCCEEDED: {
            return updateActiveData(state, (activeData => {
                assign(activeData, action.data);
            }));
        }

        case REMOVE_USER_FROM_GROUP.SUCCEEDED: {
            return updateActiveData(state, (activeData => {
                assign(activeData, action.data);
            }));
        }

        default:
            return state;
    }

};

export default reducer;
