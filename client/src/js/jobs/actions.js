/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { WS_UPDATE_JOB, WS_REMOVE_JOB, FIND_JOBS, GET_JOB, TEST_JOB, GET_RESOURCES } from "../actionTypes";

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
