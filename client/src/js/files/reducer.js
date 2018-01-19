
import { every, reject } from "lodash";

import {
    FIND_FILES,
    REMOVE_FILE,
    UPLOAD,
    UPLOAD_PROGRESS,
    HIDE_UPLOAD_OVERLAY
} from "../actionTypes";

/**
 * The initial state to give the reducer.
 *
 * @const
 * @type {object}
 */
const initialState = {
    documents: null,
    fileType: null,
    found_count: 0,
    page: 0,
    total_count: 0,
    uploads: [],
    uploadsComplete: true,
    showUploadOverlay: false
};

/**
 * If all uploads in ``state`` are complete, set the ``uploadsComplete`` property to ``true``.
 *
 * @func
 * @param state {object}
 * @returns {object}
 */
const checkUploadsComplete = (state) => ({
    ...state,
    uploadsComplete: every(state.uploads, {progress: 100})
});

export default function fileReducer (state = initialState, action) {

    switch (action.type) {

        case FIND_FILES.REQUESTED:
            return {
                ...initialState,
                showUploadOverlay: state.showUploadOverlay,
                uploads: state.uploads,
                uploadsComplete: state.uploadsComplete
            };

        case FIND_FILES.SUCCEEDED:
            const { data, fileType } = action;
            return {...state, ...data, fileType };

        case REMOVE_FILE.SUCCEEDED:
            return {...state, documents: reject(state.documents, {id: action.data.file_id})};

        case UPLOAD.REQUESTED: {
            const { name, size, type } = action.file;
            const newState = {...state,
                uploads: state.uploads.concat([{localId: action.localId, progress: 0, name, size, type}]),
                showUploadOverlay: true
            };

            return checkUploadsComplete(newState);
        }

        case UPLOAD_PROGRESS: {
            const uploads = state.uploads.map(upload => {
                if (upload.localId !== action.localId) {
                    return upload;
                }

                return {...upload, progress: action.progress};
            });

            return checkUploadsComplete({...state, uploads});
        }

        case HIDE_UPLOAD_OVERLAY:
            return {...state, showUploadOverlay: false};

    }

    return state;
}
