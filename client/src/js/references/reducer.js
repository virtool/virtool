import {
    LIST_REFERENCES,
    GET_REFERENCE,
    REMOVE_REFERENCE,
    UPLOAD,
    CHECK_REMOTE_UPDATES
} from "../actionTypes";

const initialState = {
    documents: null,
    detail: null,
    history: null
};

export default function referenceReducer (state = initialState, action) {

    switch (action.type) {

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
/*            const nowTime = new Date();
            return {
                ...state,
                detail: {
                    ...state.detail,
                    release: action.data,
                    checkPending: false,
                    remotes_from: {
                        ...state.detail.remotes_from,
                        last_checked: nowTime.toISOString()
                    }
                }};
*/
            return {...state, detail: {...state.detail, checkPending: false, release: action.data}};
        default:
            return state;
    }
}
