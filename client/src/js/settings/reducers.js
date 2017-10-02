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
    GET_CONTROL_READAHEAD_REQUESTED,
    GET_CONTROL_READAHEAD_SUCCEEDED,
    SET_SOURCE_TYPE_VALUE
} from "../actionTypes";


const initialState = {
    data: null
};

const reducer = (state = initialState, action) => {

    switch (action.type) {

        case GET_SETTINGS.SUCCEEDED:
            return assign({}, state, {data: action.data});

        case UPDATE_SETTING.SUCCEEDED:
            return assign({}, state, {data: assign({}, state.data, action.update)});

        default:
            return state;
    }

};

export default reducer;
