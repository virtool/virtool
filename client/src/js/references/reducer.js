import { find, forEach, concat, get } from "lodash-es";
import {
    WS_INSERT_REFERENCE,
    WS_UPDATE_REFERENCE,
    WS_REMOVE_REFERENCE,
    LIST_REFERENCES,
    FILTER_REFERENCES,
    GET_REFERENCE,
    EDIT_REFERENCE,
    UPLOAD,
    CHECK_REMOTE_UPDATES,
    UPDATE_REMOTE_REFERENCE
} from "../actionTypes";
import { updateList, insert, edit, remove } from "../reducerUtils";

const initialState = {
    history: null,
    documents: null,
    page: 0,
    detail: null,
    filter: "",
    fetched: false,
    refetchPage: false
};

const checkHasOfficialRemote = (list) => {
    const hasOfficialRemote = find(
        list,
        ["remotes_from", {slug: "virtool/ref-plant-viruses"}]
    );

    return !!hasOfficialRemote;
};

const checkRemoveOfficialRemote = (list, removedIds, hasOfficial) => {
    if (!hasOfficial) {
        return false;
    }

    let isRemoved = false;

    forEach(removedIds, id => {
        const target = find(list, ["id", id]);

        if (get(target, "remotes_from.slug", "") === "virtool/ref-plant-viruses") {
            isRemoved = true;
        }
    });

    return isRemoved ? !hasOfficial : hasOfficial;
};

export default function referenceReducer (state = initialState, action) {

    switch (action.type) {

        case WS_INSERT_REFERENCE:
            if (!state.fetched) {
                return state;
            }
            return {
                ...state,
                installOfficial: checkHasOfficialRemote(concat(state.documents, [action.data])),
                documents: insert(
                    state.documents,
                    state.page,
                    state.per_page,
                    action,
                    "name"
                )
            };

        case WS_UPDATE_REFERENCE:
            return {
                ...state,
                documents: edit(state.documents, action)
            };

        case WS_REMOVE_REFERENCE:
            return {
                ...state,
                installOfficial: checkRemoveOfficialRemote(state.documents, action.data, state.installOfficial),
                documents: remove(state.documents, action),
                refetchPage: (state.page < state.page_count)
            };

        case LIST_REFERENCES.REQUESTED:
            return {...state, isLoading: true, errorLoad: false};

        case LIST_REFERENCES.SUCCEEDED: {
            return {
                ...state,
                installOfficial: checkHasOfficialRemote(action.data.documents),
                ...updateList(state.documents, action, state.page),
                isLoading: false,
                errorLoad: false,
                fetched: true,
                refetchPage: false
            };
        }

        case LIST_REFERENCES.FAILED:
            return {...state, isLoading: false, errorLoad: true};

        case GET_REFERENCE.REQUESTED:
            return {...state, detail: null};

        case GET_REFERENCE.SUCCEEDED:
            return {...state, detail: action.data};

        case EDIT_REFERENCE.SUCCEEDED:
            return {...state, detail: action.data};

        case UPLOAD.SUCCEEDED:
            return {...state, importData: {...action.data}};

        case CHECK_REMOTE_UPDATES.REQUESTED:
            return {...state, detail: {...state.detail, checkPending: true }};

        case CHECK_REMOTE_UPDATES.FAILED:
            return {...state, detail: {...state.detail, checkPending: false }};

        case CHECK_REMOTE_UPDATES.SUCCEEDED:
            return {...state, detail: {...state.detail, checkPending: false, release: action.data}};

        case UPDATE_REMOTE_REFERENCE.SUCCEEDED:
            return {...state, detail: {...state.detail, release: action.data}};

        case FILTER_REFERENCES.REQUESTED:
            return {...state, filter: action.term};

        case FILTER_REFERENCES.SUCCEEDED: {
            return {...state, ...action.data};
        }

        default:
            return state;
    }
}
