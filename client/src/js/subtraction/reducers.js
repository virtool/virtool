/**
 * Redux reducers for working with job data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import {
    FIND_SUBTRACTIONS,
    LIST_SUBTRACTION_IDS,
    GET_SUBTRACTION,
    CREATE_SUBTRACTION,
    SHOW_CREATE_SUBTRACTION,
    HIDE_SUBTRACTION_MODAL
} from "../actionTypes";

const initialState = {
    documents: null,
    detail: null,
    ids: null,

    showCreate: false
};

export default function subtractionReducer (state = initialState, action) {

    switch (action.type) {

        case FIND_SUBTRACTIONS.SUCCEEDED:
            return {...state, documents: action.data.documents};

        case LIST_SUBTRACTION_IDS.SUCCEEDED:
            console.log(action);
            return {...state, ids: action.data};

        case GET_SUBTRACTION.REQUESTED:
            return {...state, detail: null};

        case GET_SUBTRACTION.SUCCEEDED:
            return {...state, detail: action.data};

        case CREATE_SUBTRACTION.SUCCEEDED:
            return {...state, showCreate: false};

        case SHOW_CREATE_SUBTRACTION:
            return {...state, showCreate: true};

        case HIDE_SUBTRACTION_MODAL:
            return {...state, showCreate: false};

        default:
            return state;
    }
}
