/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { WS_UPDATE_STATUS, FIND_HMMS, GET_HMM } from "../actionTypes";

const initialState = {
    list: null,
    detail: null,
    process: null
};

const hmmsReducer = (state = initialState, action) => {

    switch (action.type) {

        case WS_UPDATE_STATUS:
            if (action.data.id === "hmm_install") {
                return {
                    ...state,
                    process: action.data.process,
                    ready: action.data.ready,
                    size: action.data.download_size
                };
            }

            return state;

        case FIND_HMMS.SUCCEEDED:
            return {
                ...state,
                fileExists: action.data.file_exists,
                list: action.data.documents,
                page: action.data.page,
                pageCount: action.data.page_count,
                totalCount: action.data.total_count
            };

        case GET_HMM.REQUESTED:
            return {...state, detail: null};

        case GET_HMM.SUCCEEDED:
            return {...state, detail: action.data};

        default:
            return state;

    }
};

export default hmmsReducer;
