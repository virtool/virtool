/**
 * Redux reducer for working with the logged in user's account data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign, findIndex } from "lodash";
import {
    LIST_USERS,
    FILTER_USERS,
    SET_PASSWORD,
    SET_FORCE_RESET,
    SET_PRIMARY_GROUP,
    ADD_USER_TO_GROUP,
    REMOVE_USER_FROM_GROUP
} from "../actionTypes";

const updateActiveData = (state, updater) => {
    const newState = assign({}, state);

    const index = findIndex(state.list, {user_id: state.activeId});

    updater(newState.list[index]);

    return newState;
};

const initialState = {
    list: null,
    filter: ""
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

        case FILTER_USERS: {
            return assign({}, state, {filter: action.term});
        }

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
