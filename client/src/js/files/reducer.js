/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

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
    foundCount: 0,
    page: 0,
    perPage: 0,
    totalCount: 0,

    uploads: [],
    uploadsComplete: true,
    showUploadOverlay: false
};

const assignUploadsComplete = (newState) => {
    return {...newState, uploadsComplete: every(newState.uploads, {progress: 100})};
};

export default function reducer (state = initialState, action) {

    switch (action.type) {

        case FIND_FILES.REQUESTED:
            return {
                ...initialState,
                showUploadOverlay: state.showUploadOverlay,
                uploads: state.uploads,
                uploadsComplete: state.uploadsComplete
            };

        case FIND_FILES.SUCCEEDED:
            return {
                ...state,
                documents: action.data.documents,
                foundCount: action.data.found_count,
                page: action.data.page,
                pageCount: action.data.page_count,
                perPage: action.data.per_page,
                totalCount: action.data.total_count,
                fileType: action.fileType
            };

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

            const newState = {
                ...state,
                uploads
            };

            return assignUploadsComplete(newState);
        }

        case HIDE_UPLOAD_OVERLAY:
            return {...state, showUploadOverlay: false};

    }

    return state;
}
