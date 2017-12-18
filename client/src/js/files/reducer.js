import { every, reject } from "lodash";

import {
    FIND_FILES,
    REMOVE_FILE,
    UPLOAD,
    UPLOAD_PROGRESS,
    HIDE_UPLOAD_OVERLAY
} from "../actionTypes";

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

const assignUploadsComplete = (newState) => ({
    ...newState,
    uploadsComplete: every(newState.uploads, {progress: 100})
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
            return {...state, ...action.data};

        case REMOVE_FILE.SUCCEEDED:
            return {...state, documents: reject(state.documents, {id: action.data.file_id})};

        case UPLOAD.REQUESTED: {
            const fileMeta = {
                name: action.file.name,
                size: action.file.size,
                type: action.file.type
            };

            const newState = {...state,
                uploads: state.uploads.concat([{localId: action.localId, progress: 0, ...fileMeta}]),
                showUploadOverlay: true
            };

            return assignUploadsComplete(newState);
        }

        case UPLOAD_PROGRESS: {
            const uploads = state.uploads.map(upload => {
                if (upload.localId !== action.localId) {
                    return upload;
                }

                return {...upload, progress: action.progress};
            });

            return assignUploadsComplete({...state, uploads});
        }

        case HIDE_UPLOAD_OVERLAY:
            return {...state, showUploadOverlay: false};

    }

    return state;
}
