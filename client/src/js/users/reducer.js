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
import { find, differenceWith, isEqual, concat, sortBy, slice, forEach } from "lodash-es";

export const initialState = {
    list: null,
    detail: null,
    createPending: false,
    fetched: false
};

const updateList = (state, action) => {
    const beforeList = state.list ? state.list.documents : [];
    const newList = concat(beforeList, action.data.documents);

    return {...action.data, documents: newList};
};

const insertUser = (state, action) => {
    let newList = concat(state.list.documents, {...action.data});
    newList = sortBy(newList, "id");

    return {...state, list: {...state.list, documents: slice(newList, 0, (state.list.per_page * state.list.page))}};
};

const updateUser = (state, action) => {
    const newList = state.list.documents.slice();

    forEach(newList, (entry, index) => {
        if (entry.id === action.data.id) {
            newList[index] = {...action.data};
            return false;
        }
    });

    return {...state, list: {...state.list, documents: newList}, detail: action.data};
};

const removeUser = (state, action) => {
    const target = find(state.list.documents, ["id", action.data[0]]);

    if (!target) {
        return state;
    }

    const newList = differenceWith(
        state.list.documents,
        [target],
        isEqual
    );

    return {...state, list: {...state.list, documents: newList}};
};

const reducer = (state = initialState, action) => {

    switch (action.type) {

        case WS_INSERT_USER:
            return insertUser(state, action);

        case WS_UPDATE_USER:
            return updateUser(state, action);

        case WS_REMOVE_USER:
            return removeUser(state, action);

        case LIST_USERS.REQUESTED:
            return {...state, isLoading: true, errorLoad: false};

        case LIST_USERS.SUCCEEDED: {
            return {
                ...state,
                list: updateList(state, action),
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
