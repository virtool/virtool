import { map } from "lodash-es";

import {
    LIST_USERS,
    FILTER_USERS,
    CREATE_USER,
    EDIT_USER,
    ADD_USER_TO_GROUP,
    REMOVE_USER_FROM_GROUP
} from "../actionTypes";

const initialState = {
    list: null,
    filter: "",
    createPending: false,
    createError: null
};

const updateUser = (state, update) => ({
    ...state,
    list: map(state.list, user => {
        if (user.id === update.id) {
            return {...user, ...update};
        }

        return user;
    })
});

const reducer = (state = initialState, action) => {

    switch (action.type) {

        case LIST_USERS.SUCCEEDED: {
            const activeData = action.data[0];
            return {...state, list: action.data, activeId: activeData.id, activeData};
        }

        case FILTER_USERS: {
            return {...state, filter: action.term};
        }

        case CREATE_USER.SUCCEEDED:
            return {...state, list: state.list.concat([action.data])};

        case EDIT_USER.SUCCEEDED:
            return updateUser(state, action.data);

        case ADD_USER_TO_GROUP.SUCCEEDED:
        case REMOVE_USER_FROM_GROUP.SUCCEEDED:
            return updateUser(state, {groups: action.data, id: action.id});

        case CREATE_USER.REQUESTED:
            return {...state, createPending: true, createError: null};

        case CREATE_USER.FAILED:
            return {...state, createPending: false, createError: action.error};

        case EDIT_USER.REQUESTED: {
            if (action.update.password) {
                return updateUser(state, {passwordPending: true, passwordError: null});
            }

            return state;
        }

        default:
            return state;
    }

};

export default reducer;
