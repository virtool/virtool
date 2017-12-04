/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import {
    WS_UPDATE_FILE,
    WS_REMOVE_FILE,
    FIND_FILES,
    REMOVE_FILE,
    UPLOAD,
    UPLOAD_PROGRESS,
    HIDE_UPLOAD_OVERLAY
} from "../actionTypes";

export function wsUpdateFile () {
    return {
        type: WS_UPDATE_FILE
    };
}

export function wsRemoveFile () {
    return {
        type: WS_REMOVE_FILE
    };
}

export function findFiles (fileType) {
    return {
        type: FIND_FILES.REQUESTED,
        fileType
    };
}

export function upload (localId, file, fileType, onProgress) {
    return {
        type: UPLOAD.REQUESTED,
        localId,
        file,
        fileType,
        onProgress
    };
}

export function removeFile (fileId) {
    return {
        type: REMOVE_FILE.REQUESTED,
        fileId
    };
}

export function uploadProgress (localId, progress) {
    return {
        type: UPLOAD_PROGRESS,
        localId,
        progress
    };
}

export function hideUploadOverlay () {
    return {
        type: HIDE_UPLOAD_OVERLAY
    };
}
