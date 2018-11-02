import {
    WS_INSERT_USER,
    WS_UPDATE_USER,
    WS_REMOVE_USER,
    FIND_USERS,
    GET_USER,
    CREATE_USER,
    EDIT_USER
} from "../app/actionTypes";
import { updateDocuments, insert, update, remove } from "../utils/reducers";

export const initialState = {
    documents: null,
    term: "",
    page: 1,
    detail: null,
    createPending: false,
    passwordPending: false
};

const reducer = (state = initialState, action) => {
    switch (action.type) {
        case WS_INSERT_USER:
            return insert(state, action, "id");

        case WS_UPDATE_USER:
            return update(state, action);

        case WS_REMOVE_USER:
            return remove(state, action);

        case FIND_USERS.REQUESTED:
            return {
                ...state,
                term: action.term
            };

        case FIND_USERS.SUCCEEDED:
            return updateDocuments(state, action);

        case GET_USER.REQUESTED:
            return { ...state, detail: null };

        case GET_USER.SUCCEEDED:
            return { ...state, detail: action.data };

        case CREATE_USER.REQUESTED:
            return { ...state, createPending: true };

        case CREATE_USER.SUCCEEDED:
        case CREATE_USER.FAILED:
            return { ...state, createPending: false };

        case EDIT_USER.REQUESTED: {
            if (action.update.password) {
                return { ...state, passwordPending: true };
            }
            return state;
        }

        case EDIT_USER.SUCCEEDED:
            return { ...state, detail: action.data };

        default:
            return state;
    }
};

export default reducer;
