/**
 * Redux action creators for use with file management.
 *
 * @module files/actions
 */

import { simpleActionCreator } from "../utils";
import {
    WS_UPDATE_FILE,
    WS_REMOVE_FILE,
    FIND_FILES,
    REMOVE_FILE,
    UPLOAD,
    UPLOAD_PROGRESS,
    HIDE_UPLOAD_OVERLAY
} from "../actionTypes";

/**
 * Returns an action that should be dispatched when a file document is updated via websocket.
 *
 * @func
 * @param data {object} the data passed in the websocket message
 * @returns {object}
 */
export const wsUpdateFile = (data) => ({
    type: WS_UPDATE_FILE,
    data
});

/**
 * Returns an action that should be dispatched when a file document is removed via websocket.
 *
 * @func
 * @param data {object} the data passed in the websocket message
 * @returns {object}
 */
export const wsRemoveFile = (data) => ({
    type: WS_REMOVE_FILE,
    data
});

/**
 * Returns an action that can trigger an API call that finds file documents.
 *
 * @func
 * @param fileType {string} a file type to filter the returned documents by
 * @param page {number} which page of results to return
 * @returns {object}
 */
export const findFiles = (fileType, page) => ({
    type: FIND_FILES.REQUESTED,
    fileType,
    page
});

/**
 * Returns an action that can trigger the upload of a file to the server.
 *
 * @param localId
 * @param file
 * @param fileType
 * @param onProgress
 * @returns {{type: string, localId: *, file: *, fileType: *, onProgress: *}}
 */
export const upload = (localId, file, fileType, onProgress) => ({
    type: UPLOAD.REQUESTED,
    localId,
    file,
    fileType,
    onProgress
});

export const removeFile = (fileId) => ({
    type: REMOVE_FILE.REQUESTED,
    fileId
});

export const uploadProgress = (localId, progress) => ({
    type: UPLOAD_PROGRESS,
    localId,
    progress
});

export const hideUploadOverlay = simpleActionCreator(HIDE_UPLOAD_OVERLAY);
