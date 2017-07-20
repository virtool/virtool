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
    documents: null,
    detail: null,
    resources: null,
    cuda: null
};

const updateJob = (state, action) => {
    return assign({}, state, {
        documents: state.documents.map(doc => {
            if (doc.id !== action.data.id) {
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
                documents: reject(state.documents, {id: action.jobId})
            });

        case FIND_JOBS.SUCCEEDED:
            console.log(action.data);

            return assign({}, state, {
                foundCount: action.data.found_count,
                page: action.data.page,
                pageCount: action.data.page_count,
                perPage: action.data.per_page,
                totalCount: action.data.total_count,
                documents: action.data.documents
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
                documents: reject(state.documents, {id: action.jobId})
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
