/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign, every } from "lodash";

import { FIND_FILES, REMOVE_FILE, UPLOAD_READS, UPLOAD_PROGRESS, HIDE_UPLOAD_OVERLAY } from "../actionTypes";

const initialState = {
    documents: null,
    uploads: [],
    uploadsComplete: true,
    showUploadOverlay: false
};

const assignUploadsComplete = (newState) => {
    return assign({}, newState, {uploadsComplete: every(newState.uploads, {progress: 100})});
};

export default function reducer (state = initialState, action) {

    switch (action.type) {

        case FIND_FILES.SUCCEEDED:
            return assign({}, state, {
                documents: action.data.documents
            });

        case UPLOAD_READS.REQUESTED: {
            const fileMeta = {
                name: action.file.name,
                size: action.file.size,
                type: action.file.type
            };

            const newState = assign({}, state, {
                uploads: state.uploads.concat([assign({}, {localId: action.localId}, {progress: 0}, fileMeta)]),
                showUploadsOverlay: true
            });

            return assignUploadsComplete(newState);
        }

        case UPLOAD_PROGRESS: {
            const newState = assign({}, state, {
                uploads: state.uploads.map(upload => {
                    if (upload.localId !== action.localId) {
                        return upload;
                    }

                    return assign({}, upload, {
                        progress: action.progress
                    });
                })
            });

            return assignUploadsComplete(newState);
        }

        case HIDE_UPLOAD_OVERLAY:
            return assign({}, state, {showUploadOverlay: false});

    }

    return state;
}
