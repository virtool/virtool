/**
 * Redux reducers for working with job data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { reject } from "lodash";
import {
    WS_UPDATE_JOB,
    WS_REMOVE_JOB,
    FIND_JOBS,
    GET_JOB,
    CANCEL_JOB,
    REMOVE_JOB,
    GET_RESOURCES
} from "../actionTypes";

const initialState = {
    documents: null,
    detail: null,
    resources: null
};

const updateJob = (state, action) => {
    return {...state, documents: state.documents.map(doc =>
        doc.id !== action.data.id ? doc: {...doc, ...action.data}
    )};
};

export default function jobsReducer (state = initialState, action) {

    switch (action.type) {

        case WS_UPDATE_JOB:
            return state.documents === null ? state: updateJob(state, action);

        case WS_REMOVE_JOB:
            return {...state, documents: reject(state.documents, {id: action.jobId})};

        case FIND_JOBS.SUCCEEDED:
            return {
                ...state,
                foundCount: action.data.found_count,
                page: action.data.page,
                pageCount: action.data.page_count,
                perPage: action.data.per_page,
                totalCount: action.data.total_count,
                documents: action.data.documents
            };

        case GET_JOB.REQUESTED:
            return {...state, detail: null};

        case GET_JOB.SUCCEEDED:
            return {...state, detail: action.data};

        case CANCEL_JOB.SUCCEEDED:
            return updateJob(state, action);

        case REMOVE_JOB.SUCCEEDED:
            return {...state, documents: reject(state.documents, {id: action.jobId})};

        case GET_RESOURCES.SUCCEEDED:
            return {...state, resources: action.data};

        default:
            return state;
    }
}
