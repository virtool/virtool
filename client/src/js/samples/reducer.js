import { xor } from "lodash-es";
import {
    CLEAR_SAMPLE_SELECTION,
    FIND_READ_FILES,
    FIND_SAMPLES,
    GET_SAMPLE,
    HIDE_SAMPLE_MODAL,
    REMOVE_SAMPLE,
    SELECT_SAMPLE,
    SHOW_REMOVE_SAMPLE,
    UPDATE_SAMPLE,
    UPDATE_SAMPLE_RIGHTS,
    WS_INSERT_SAMPLE,
    WS_REMOVE_SAMPLE,
    WS_UPDATE_SAMPLE
} from "../app/actionTypes";
import { insert, remove, update, updateDocuments } from "../utils/reducers";

export const initialState = {
    documents: null,
    term: "",
    page: 0,
    detail: null,
    readFiles: null,
    showEdit: false,
    showRemove: false,
    editError: false,
    reservedFiles: [],
    readyHosts: null,
    selected: [],
    pathoscopeCondition: [true, false, "ip"],
    nuvsCondition: [true, false, "ip"]
};

export default function samplesReducer(state = initialState, action) {
    switch (action.type) {
        case WS_INSERT_SAMPLE:
            return insert(state, action, "created_at", true);

        case WS_UPDATE_SAMPLE:
            return update(state, action, "created_at", true);

        case WS_REMOVE_SAMPLE:
            return remove(state, action);

        case FIND_SAMPLES.REQUESTED: {
            const { term, pathoscope, nuvs } = action;
            return {
                ...state,
                term,
                pathoscopeCondition: pathoscope,
                nuvsCondition: nuvs
            };
        }

        case FIND_SAMPLES.SUCCEEDED:
            return updateDocuments(state, action, "created_at", true);

        case FIND_READ_FILES.SUCCEEDED:
            return { ...state, readFiles: action.data.documents };

        case GET_SAMPLE.REQUESTED:
            return { ...state, detail: null };

        case GET_SAMPLE.SUCCEEDED:
            return { ...state, detail: action.data };

        case UPDATE_SAMPLE.SUCCEEDED:
            return { ...state, detail: { ...state.detail, ...action.data } };

        case UPDATE_SAMPLE_RIGHTS.SUCCEEDED:
            return { ...state, detail: { ...state.detail, ...action.data } };

        case REMOVE_SAMPLE.SUCCEEDED:
            return { ...state, detail: null };

        case SHOW_REMOVE_SAMPLE:
            return { ...state, showRemove: true };

        case HIDE_SAMPLE_MODAL:
            return { ...state, showRemove: false };

        case SELECT_SAMPLE:
            return {
                ...state,
                selected: xor(state.selected, [action.sampleId])
            };

        case CLEAR_SAMPLE_SELECTION:
            return {
                ...state,
                selected: []
            };

        default:
            return state;
    }
}
