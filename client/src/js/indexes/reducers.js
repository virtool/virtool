/**
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign, concat, find, reject } from "lodash";
import { WS_UPDATE_INDEX, FIND_INDEXES, CREATE_INDEX, CLEAR_INDEX_ERROR } from "../actionTypes";

const initialState = {
    documents: null,
    modifiedCount: 0,
    totalCount: 0,
    error: false
};

const indexesReducer = (state = initialState, action) => {

    switch (action.type) {

        case WS_UPDATE_INDEX:
            return assign({}, state, {
                viruses: concat(
                    reject(state.documents, {index_id: action.index_id}),
                    assign({}, find(state.documents, {index_id: action.index_id}), action.data)
                )
            });

        case FIND_INDEXES.SUCCEEDED:
            return assign({}, state, {
                documents: action.data.documents,
                modifiedCount: action.data.modified_virus_count,
                totalCount: action.data.total_virus_count
            });

        case CREATE_INDEX.FAILED:
            return assign({}, state, {
                error: true
            });

        case CLEAR_INDEX_ERROR:
            return assign({}, state, {
                error: false
            });

        default:
            return state;
    }
};

export default indexesReducer;
