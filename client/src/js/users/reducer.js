import {
    LIST_USERS,
    FILTER_USERS,
    GET_USER,
    CREATE_USER,
    EDIT_USER
} from "../actionTypes";

export const initialState = {
    list: null,
    detail: null,
    createPending: false
};

const reducer = (state = initialState, action) => {

    switch (action.type) {

        case LIST_USERS.REQUESTED:
            return {...state, isLoading: true, errorLoad: false};

        case LIST_USERS.SUCCEEDED: {
            return {...state, list: action.data, isLoading: false, errorLoad: false};
        }

        case LIST_USERS.FAILED: {
            return {...state, isLoading: false, errorLoad: true};
        }

        case FILTER_USERS.SUCCEEDED: {
            return {...state, list: action.data};
        }

        case GET_USER.REQUESTED:
            return {...state, detail: null};

        case GET_USER.SUCCEEDED: {
            return {...state, detail: action.data};
        }

        case EDIT_USER.SUCCEEDED:
            return {...state, detail: action.data};

        case CREATE_USER.REQUESTED:
            return {...state, createPending: true};

        case CREATE_USER.SUCCEEDED:
            return {...state, list: {
                ...state.list,
                documents: state.list.documents.concat([action.data])
            }};

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
