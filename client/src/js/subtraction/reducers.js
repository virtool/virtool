/**
 * Redux reducers for working with job data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign, } from "lodash";
import { FIND_SUBTRACTIONS, GET_SUBTRACTION, SHOW_CREATE_SUBTRACTION, HIDE_SUBTRACTION_MODAL } from "../actionTypes";
import {CREATE_SUBTRACTION} from "../actionTypes";

const initialState = {
    documents: null,
    detail: null,

    showCreate: false
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

        case CREATE_SUBTRACTION.SUCCEEDED:
            return assign({}, state, {
                showCreate: false
            });

        case SHOW_CREATE_SUBTRACTION:
            return assign({}, state, {
                showCreate: true
            });

        case HIDE_SUBTRACTION_MODAL:
            return assign({}, state, {
                showCreate: false
            });

        default:
            return state;
    }
}
