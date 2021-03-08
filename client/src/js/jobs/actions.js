import {
    CANCEL_JOB,
    CLEAR_JOBS,
    FIND_JOBS,
    GET_JOB,
    GET_LINKED_JOB,
    REMOVE_JOB,
    WS_INSERT_JOB,
    WS_REMOVE_JOB,
    WS_UPDATE_JOB
} from "../app/actionTypes";

export const wsInsertJob = data => ({
    type: WS_INSERT_JOB,
    data
});

/**
 * Returns an action that should be dispatched when a job document is updated via websocket.
 *
 * @func
 * @param data {object} the data passed in the websocket message
 * @returns {object}
 */
export const wsUpdateJob = data => ({
    type: WS_UPDATE_JOB,
    data
});

/**
 * Returns an action that should be dispatched when a job document is removed via websocket.
 *
 * @func
 * @param jobId {string} the id for the specific job
 * @returns {object}
 */
export const wsRemoveJob = data => ({
    type: WS_REMOVE_JOB,
    data
});

/**
 * Returns action that can trigger an API call for getting all available jobs.
 *
 * @func
 * @returns {object}
 */

export const findJobs = (term, page) => ({
    type: FIND_JOBS.REQUESTED,
    term,
    page
});

/**
 * Returns action that can trigger an API call for getting a specific job document.
 *
 * @func
 * @param jobId {string} the id for the specific job
 * @returns {object}
 */
export const getJob = jobId => ({
    type: GET_JOB.REQUESTED,
    jobId
});

export const getLinkedJob = jobId => ({
    type: GET_LINKED_JOB.REQUESTED,
    jobId
});

/**
 * Returns action that can trigger an API call for cancelling a currently running job.
 *
 * @func
 * @param jobId {string} the id for the specific job
 * @returns {object}
 */
export const cancelJob = jobId => ({
    type: CANCEL_JOB.REQUESTED,
    jobId
});

/**
 * Returns action that can trigger an API call for removing a specific job.
 *
 * @func
 * @param jobId {string} the id for the specific job
 * @returns {object}
 */
export const removeJob = jobId => ({
    type: REMOVE_JOB.REQUESTED,
    jobId
});

/**
 * Returns action that can trigger an API call for clearing a subset of listed jobs.
 *
 * @func
 * @param scope {string} keyword for a category of jobs
 * @returns {object}
 */
export const clearJobs = scope => ({
    type: CLEAR_JOBS.REQUESTED,
    scope
});
