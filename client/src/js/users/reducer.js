import { map } from "lodash-es";

import {
    LIST_USERS,
    FILTER_USERS,
    CREATE_USER,
    EDIT_USER
} from "../actionTypes";

export const initialState = {
    list: null,
    filter: "",
    createPending: false
};

export const updateUser = (state, update) => ({
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
            return {...state, list: action.data};
        }

        case FILTER_USERS: {
            return {...state, filter: action.term};
        }

        case CREATE_USER.SUCCEEDED:
            return {...state, list: state.list.concat([action.data])};

        case EDIT_USER.SUCCEEDED:
            return updateUser(state, action.data);

        case CREATE_USER.REQUESTED:
            return {...state, createPending: true};

        case CREATE_USER.FAILED:
            return {...state, createPending: false};

        case EDIT_USER.REQUESTED: {
            if (action.update.password) {
                return {...state, passwordPending: true};
            }

            return state;
        }

        default:
            return state;
    }

};

export default reducer;
