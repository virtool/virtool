/**
 * Functions for communication with API endpoints related to uploaded files.
 *
 * @module files/api
 */
import Request from "superagent";

export const find = ({ fileType, page, perPage }) =>
    Request.get("/api/files").query({
        type: fileType,
        per_page: perPage,
        page
    });

/**
 * Get files of the given ``fileType``. Get a specific page of results using the ``page`` argument.
 *
 * @func
 * @param fileType {string} the file type to get
 * @param page {number} the page of results to get
 * @returns {promise}
 */
export const list = ({ fileType, page }) =>
    Request.get("/api/files").query({
        type: fileType,
        page
    });

/**
 * Remove the file with the given ``fileId``.
 *
 * @func
 * @param fileId {string} the fileId to remove
 * @returns {promise}
 */
export const remove = ({ fileId }) => Request.delete(`/api/files/${fileId}`);

/**
 * Upload a ``file`` with the given ``fileType``. Pass progress events to ``onProgress``.
 *
 * @func
 * @param file {object} the file object to upload
 * @param fileType {string} the file type to assign to the uploaded file
 * @param onProgress {function} a callback to call with ``ProgressEvent``s when they are fired
 * @returns {promise}
 */
export const upload = (file, fileType, onProgress, onSuccess, onFailure) =>
    Request.post(`/upload/${fileType}`)
        .query({ name: file.name })
        .attach("file", file)
        .on("progress", onProgress)
        .then(onSuccess)
        .catch(onFailure);
