import {
    WS_UPDATE_REFERENCE,
    LIST_REFERENCES,
    GET_REFERENCE,
    REMOVE_REFERENCE,
    UPLOAD,
    CHECK_REMOTE_UPDATES,
    UPDATE_REMOTE_REFERENCE
} from "../actionTypes";

const initialState = {
    documents: null,
    detail: null,
    history: null
};

export default function referenceReducer (state = initialState, action) {

    switch (action.type) {

        case WS_UPDATE_REFERENCE:
            return {...state, detail: {...state.detail, process: action.data.process, release: action.data.release}};

        case LIST_REFERENCES.SUCCEEDED:
            return {...state, ...action.data};

        case GET_REFERENCE.SUCCEEDED:
            return {...state, detail: action.data};

        case REMOVE_REFERENCE.SUCCEEDED:
            return {...state, detail: null};

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

        default:
            return state;
    }
}
