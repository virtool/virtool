/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { FIND_HMMS, GET_HMM } from "../actionTypes";

const initialState = {
    list: null,
    detail: null
};

const hmmsReducer = (state = initialState, action) => {

    switch (action.type) {

        case FIND_HMMS.SUCCEEDED:
            return {
                ...state,
                fileExists: action.data.file_exists,
                list: action.data.documents,
                page: action.data.page,
                pageCount: action.data.page_count,
                totalCount: action.data.total_count
            };

        case GET_HMM.SUCCEEDED:
            return {...state, detail: action.data};

        default:
            return state;

    }
};

export default hmmsReducer;
