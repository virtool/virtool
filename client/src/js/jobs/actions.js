/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { FIND_JOBS, GET_JOB } from "../actionTypes";

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
