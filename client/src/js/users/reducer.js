import {
    WS_INSERT_USER,
    WS_UPDATE_USER,
    WS_REMOVE_USER,
    LIST_USERS,
    FILTER_USERS,
    GET_USER,
    CREATE_USER,
    EDIT_USER
} from "../actionTypes";
import { updateList, insert, edit, remove } from "../reducerUtils";

export const initialState = {
    list: null,
    detail: null,
    createPending: false,
    fetched: false
};

const reducer = (state = initialState, action) => {

    switch (action.type) {

        case WS_INSERT_USER:
            return {
                ...state,
                list: {
                    ...state.list,
                    documents: insert(
                        state.list.documents,
                        state.list.page,
                        state.list.per_page,
                        action)
                }
            };

        case WS_UPDATE_USER:
            return {
                ...state,
                list: {
                    ...state.list,
                    documents: edit(state.list.documents, action)
                },
                detail: action.data
            };

        case WS_REMOVE_USER:
            return {...state, list: {...state.list, documents: remove(state.list.documents, action)}};

        case LIST_USERS.REQUESTED:
            return {...state, isLoading: true, errorLoad: false};

        case LIST_USERS.SUCCEEDED: {
            const list = state.list ? state.list.documents : null;
            return {
                ...state,
                list: updateList(list, action),
                isLoading: false,
                errorLoad: false,
                fetched: true
            };
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

        //case EDIT_USER.SUCCEEDED:
        //    return {...state, detail: action.data};

        case CREATE_USER.REQUESTED:
            return {...state, createPending: true};

/*        case CREATE_USER.SUCCEEDED:
            return {...state, list: {
                ...state.list,
                documents: state.list.documents.concat([action.data])
            }};
*/
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
