import { simpleActionCreator } from "../utils";
import {
    WS_UPDATE_JOB,
    WS_REMOVE_JOB,
    FIND_JOBS,
    GET_JOB,
    CANCEL_JOB,
    REMOVE_JOB,
    CLEAR_JOBS,
    GET_RESOURCES
} from "../actionTypes";

export const wsUpdateJob = (data) => ({
    type: WS_UPDATE_JOB,
    data
});

export const wsRemoveJob = (jobId) => ({
    type: WS_REMOVE_JOB,
    jobId
});

export const findJobs = (term, page) => ({
    type: FIND_JOBS.REQUESTED,
    term,
    page
});

export const getJob = (jobId) => ({
    type: GET_JOB.REQUESTED,
    jobId
});

export const cancelJob = (jobId) => ({
    type: CANCEL_JOB.REQUESTED,
    jobId
});

export const removeJob = (jobId) => ({
    type: REMOVE_JOB.REQUESTED,
    jobId
});

export const clearJobs = (scope) => ({
    type: CLEAR_JOBS.REQUESTED,
    scope
});

export const getResources = simpleActionCreator(GET_RESOURCES.REQUESTED);
