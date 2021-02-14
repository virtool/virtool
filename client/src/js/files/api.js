/**
 * Functions for communication with API endpoints related to uploaded files.
 *
 * @module files/api
 */
import { Request } from "../app/request";

export const find = ({ fileType }) =>
    Request.get("/api/uploads").query({
        type: fileType
    });

/**
 * Get files of the given ``fileType``. Get a specific page of results using the ``page`` argument.
 *
 * @func
 * @param fileType {string} the file type to get
 * @param page {number} the page of results to get
 * @returns {promise}
 */
export const list = ({ fileType }) =>
    Request.get("/api/uploads").query({
        type: fileType
    });

/**
 * Remove the file with the given ``fileId``.
 *
 * @func
 * @param fileId {string} the fileId to handleRemove
 * @returns {promise}
 */
export const remove = ({ fileId }) => Request.delete(`/api/uploads/${fileId}`);

/**
 * Upload a ``file`` with the given ``fileType``. Pass progress events to ``onProgress``.
 *
 * @func
 * @param file {object} the file object to upload
 * @param fileType {string} the file type to assign to the uploaded file
 * @param onProgress {function} a callback to call with ``ProgressEvent``s when they are fired
 * @param onSuccess {function} a callback to call when the upload succeeds
 * @param onFailure {function} a callback to call when the upload fails
 * @returns {promise}
 */
export const upload = ({ file, fileType, onProgress, onSuccess, onFailure }) =>
    Request.post(`/api/uploads`)
        .query({ name: file.name, type: fileType })
        .attach("file", file)
        .on("progress", onProgress)
        .then(onSuccess)
        .catch(onFailure);
