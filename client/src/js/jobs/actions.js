/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import {
    WS_UPDATE_JOB,
    WS_REMOVE_JOB,
    FIND_JOBS,
    GET_JOB,
    CANCEL_JOB,
    REMOVE_JOB,
    CLEAR_JOBS,
    GET_RESOURCES,
} from "../actionTypes";

export const wsUpdateJob = (data) => {
    return {
        type: WS_UPDATE_JOB,
        data
    };
};

export const wsRemoveJob = (jobId) => {
    return {
        type: WS_REMOVE_JOB,
        jobId
    };
};

export const findJobs = (term, page) => {
    return {
        type: FIND_JOBS.REQUESTED,
        term,
        page
    };
};

export const getJob = (jobId) => {
    return {
        type: GET_JOB.REQUESTED,
        jobId
    };
};

export const cancelJob = (jobId) => {
    return {
        type: CANCEL_JOB.REQUESTED,
        jobId
    };
};

export const removeJob = (jobId) => {
    return {
        type: REMOVE_JOB.REQUESTED,
        jobId
    };
};

export const clearJobs = (scope) => {
    return {
        type: CLEAR_JOBS.REQUESTED,
        scope
    };
};

export const getResources = () => {
    return {
        type: GET_RESOURCES.REQUESTED
    };
};
