/**
 * Exports a reducer for managing uploaded files.
 *
 * @module files/reducer
 */
import { every, map } from "lodash-es";
import { updateDocuments, insert, update, remove } from "../utils/reducers";
import {
    WS_INSERT_FILE,
    WS_UPDATE_FILE,
    WS_REMOVE_FILE,
    FIND_FILES,
    UPLOAD,
    UPLOAD_PROGRESS,
    HIDE_UPLOAD_OVERLAY,
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
    uploads: [],
    uploadsComplete: true,
    showUploadOverlay: false
};

export const appendUpload = (state, action) => {
    const { context, file, fileType, localId } = action;
    const { name, size } = file;

    return {
        ...state,
        uploads: state.uploads.concat([{ localId, progress: 0, name, size, type: fileType, context }]),
        showUploadOverlay: true
    };
};

/**
 * If all uploads in ``state`` are complete, set the ``uploadsComplete`` property to ``true``.
 *
 * @func
 * @param state {object}
 * @returns {object}
 */
export const checkUploadsComplete = state => ({
    ...state,
    uploadsComplete: every(state.uploads, { progress: 100 })
});

export const pruneUploads = (state, action) => {
    const uploads = map(state.uploads, upload => {
        if (upload.localId !== action.localId) {
            return upload;
        }

        return { ...upload, progress: action.progress };
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
                return insert(state, action, "created_at", true);
            }

            return state;

        case WS_UPDATE_FILE:
            return update(state, action, "created_at", true);

        case WS_REMOVE_FILE:
            return remove(state, action);

        case FIND_FILES.REQUESTED:
            return {
                ...state,
                term: action.term
            };

        case FIND_FILES.SUCCEEDED:
            return {
                ...updateDocuments(state, action, "created_at", true),
                fileType: action.fileType
            };

        case UPLOAD.REQUESTED:
        case UPLOAD_SAMPLE_FILE.REQUESTED:
            return checkUploadsComplete(appendUpload(state, action));

        case UPLOAD_PROGRESS:
            return checkUploadsComplete(pruneUploads(state, action));

        case HIDE_UPLOAD_OVERLAY:
            return { ...state, showUploadOverlay: false };
    }

    return state;
}
