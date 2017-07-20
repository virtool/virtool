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
    TEST_JOB,
    GET_RESOURCES,
    GET_CUDA
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

export const findJobs = () => {
    return {
        type: FIND_JOBS.REQUESTED
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

export const test = () => {
    return {
        type: TEST_JOB.REQUESTED,
        long: true
    };
};

export const getResources = () => {
    return {
        type: GET_RESOURCES.REQUESTED
    };
};

export const getCUDA = () => {
    return {
        type: GET_CUDA.REQUESTED
    };
};
