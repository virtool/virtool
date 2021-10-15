/**
 * Exports a reducer for managing uploaded files.
 *
 * @module files/reducer
 */
import { map, reject } from "lodash-es";
import { updateDocuments, insert, update, remove } from "../utils/reducers";
import {
    WS_INSERT_FILE,
    WS_UPDATE_FILE,
    WS_REMOVE_FILE,
    FIND_FILES,
    UPLOAD,
    UPLOAD_PROGRESS,
    UPLOAD_SAMPLE_FILE
} from "../app/actionTypes";

/**
 * The initial state to give the reducer.
 *
 * @const
 * @type {object}
 */
export const initialState = {
    documents: null,
    fileType: null,
    found_count: 0,
    page: 0,
    total_count: 0,
    uploads: []
};

export const appendUpload = (state, action) => {
    const { context, file, fileType, localId } = action;
    const { name, size } = file;

    return {
        ...state,
        uploads: state.uploads.concat([{ localId, progress: 0, name, size, type: fileType, context }])
    };
};

/**
 * Remove finished uploads.
 *
 * @func
 * @param state {object}
 * @returns {object}
 */
export const cleanUploads = state => ({
    ...state,
    uploads: reject(state.uploads, { progress: 100 })
});

/**
 * Update the progress for an upload.
 *
 * @param state
 * @param action
 */
export const updateProgress = (state, action) => {
    const uploads = map(state.uploads, upload => {
        if (upload.localId === action.localId) {
            return { ...upload, progress: action.progress };
        }

        return upload;
    });

    return { ...state, uploads };
};

/**
 * A reducer for managing uploaded files.
 *
 * @param state {object}
 * @param action {object}
 * @returns {object}
 */
export default function fileReducer(state = initialState, action) {
    switch (action.type) {
        case WS_INSERT_FILE:
            if (action.data.type === state.fileType) {
                return insert(state, action, "uploaded_at", true);
            }

            return state;

        case WS_UPDATE_FILE:
            return update(state, action, "uploaded_at", true);

        case WS_REMOVE_FILE:
            return remove(state, action);

        case FIND_FILES.REQUESTED:
            return {
                ...state,
                term: action.term,
                documents: state.fileType === action.fileType ? state.documents : null,
                fileType: ""
            };

        case FIND_FILES.SUCCEEDED:
            return {
                ...updateDocuments(state, action, "uploaded_at", true),
                fileType: action.context.fileType
            };

        case UPLOAD.REQUESTED:
        case UPLOAD_SAMPLE_FILE.REQUESTED:
            return cleanUploads(appendUpload(state, action));

        case UPLOAD_PROGRESS:
            return cleanUploads(updateProgress(state, action));
    }

    return state;
}
