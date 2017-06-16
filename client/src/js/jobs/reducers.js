/**
 * Redux reducers for working with job data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign, reject } from "lodash";
import {
    WS_UPDATE_JOB,
    WS_REMOVE_JOB,
    FIND_JOBS,
    GET_JOB,
    CANCEL_JOB,
    REMOVE_JOB,
    GET_RESOURCES,
    GET_CUDA
} from "../actionTypes";

const initialState = {
    list: null,
    detail: null,
    resources: null,
    cuda: null
};

const updateJob = (state, action) => {
    return assign({}, state, {
        list: state.list.map(doc => {
            if (doc.job_id !== action.data.job_id) {
                return doc;
            }

            return assign({}, doc, action.data);
        })
    });
};

export default function reducer (state = initialState, action) {

    switch (action.type) {

        case WS_UPDATE_JOB:
            return updateJob(state, action);

        case WS_REMOVE_JOB:
            return assign({}, state, {
                list: reject(state.list, {job_id: action.jobId})
            });

        case FIND_JOBS.SUCCEEDED:
            return assign({}, state, {
                list: action.data
            });

        case GET_JOB.REQUESTED:
            return assign({}, state, {
                detail: null
            });

        case GET_JOB.SUCCEEDED:
            return assign({}, state, {
                detail: action.data
            });

        case CANCEL_JOB.SUCCEEDED:
            return updateJob(state, action);

        case REMOVE_JOB.SUCCEEDED:
            return assign({}, state, {
                list: reject(state.list, {job_id: action.jobId})
            });

        case GET_RESOURCES.SUCCEEDED:
            return assign({}, state, {
                resources: action.data
            });

        case GET_CUDA.REQUESTED:
            return assign({}, state, {
                cuda: null
            });

        case GET_CUDA.SUCCEEDED:
            return assign({}, state, {
                cuda: action.data
            });

        default:
            return state;
    }
}
