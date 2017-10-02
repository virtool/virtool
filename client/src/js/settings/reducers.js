/**
 * Redux reducer for working with the logged in user's account data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign } from "lodash";
import {
    GET_SETTINGS,
    UPDATE_SETTING,
    GET_CONTROL_READAHEAD
} from "../actionTypes";


const initialState = {
    data: null,
    readahead: null,
    readaheadPending: false
};

const reducer = (state = initialState, action) => {

    switch (action.type) {

        case GET_SETTINGS.SUCCEEDED:
            return assign({}, state, {data: action.data});

        case UPDATE_SETTING.SUCCEEDED:
            return assign({}, state, {data: assign({}, state.data, action.update)});

        case GET_CONTROL_READAHEAD.REQUESTED:
            return assign({}, state, {
                readaheadPending: true
            });

        case GET_CONTROL_READAHEAD.SUCCEEDED:
            return assign({}, state, {
                readahead: action.data,
                readaheadPending: false
            });

        case GET_CONTROL_READAHEAD.FAILED:
            return assign({}, state, {
                readaheadPending:false
            });

        default:
            return state;
    }

};

export default reducer;
