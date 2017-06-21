/**
 * Redux reducers for working with job data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign, } from "lodash";
import { WS_UPDATE_SUBTRACTION, WS_REMOVE_SUBTRACTION, FIND_SUBTRACTIONS, GET_SUBTRACTION } from "../actionTypes";

const initialState = {
    documents: null,
    detail: null
};

export default function subtractionReducer (state = initialState, action) {

    switch (action.type) {

        case FIND_SUBTRACTIONS.SUCCEEDED:
            return assign({}, state, {documents: action.data.documents});

        case GET_SUBTRACTION.REQUESTED:
            return assign({}, state, {
                detail: null
            });

        case GET_SUBTRACTION.SUCCEEDED:
            return assign({}, state, {
                detail: action.data
            });

        default:
            return state;
    }
}
