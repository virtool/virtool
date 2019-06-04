/**
 * Redux action creators for use with file management.
 *
 * @module files/actions
 */

import {
    WS_INSERT_FILE,
    WS_UPDATE_FILE,
    WS_REMOVE_FILE,
    FIND_FILES,
    REMOVE_FILE,
    UPLOAD,
    UPLOAD_PROGRESS
} from "../app/actionTypes";

export const wsInsertFile = data => ({
    type: WS_INSERT_FILE,
    data
});

/**
 * Returns an action that should be dispatched when a file document is updated via websocket.
 *
 * @func
 * @param data {object} the data passed in the websocket message
 * @returns {object}
 */
export const wsUpdateFile = data => ({
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
export const wsRemoveFile = data => ({
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
export const findFiles = (fileType, term, page) => ({
    type: FIND_FILES.REQUESTED,
    fileType,
    term,
    page
});

/**
 * Returns an action that can trigger the upload of a file to the server.
 *
 * @func
 * @param localId {string} the local id for the upload (NOT the fileId)
 * @param file {object} file to be uploaded
 * @param fileType {string} file type
 * @param context {object} extra information to attach to the upload object
 * @returns {object}
 */
export const upload = (localId, file, fileType, context = {}) => ({
    type: UPLOAD.REQUESTED,
    localId,
    file,
    fileType,
    context
});

/**
 * Returns an action that can trigger an API call that removes a file by its fileId.
 *
 * @func
 * @param fileId {string} the unique id for the file
 * @returns {object}
 */
export const removeFile = fileId => ({
    type: REMOVE_FILE.REQUESTED,
    fileId
});

/**
 * Returns and action that updates the progress of an ongoing upload.
 *
 * @func
 * @param localId {string} the local id for the upload (NOT the fileId)
 * @param progress {number} the new progress value
 * @returns {object}
 */
export const uploadProgress = (localId, progress) => ({
    type: UPLOAD_PROGRESS,
    localId,
    progress
});
