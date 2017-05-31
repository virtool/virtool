/**
 * Redux reducer for working with the logged in user's account data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign } from "lodash";
import { combineReducers } from "redux";
import {
    GET_SETTINGS_SUCCEEDED,
    UPDATE_SETTINGS_SUCCEEDED,
    GET_CONTROL_READAHEAD_REQUESTED,
    GET_CONTROL_READAHEAD_SUCCEEDED,
    SET_SOURCE_TYPE_VALUE
} from "../actionTypes";

const dataReducer = (state = {}, action) => {

    switch (action.type) {

        case GET_SETTINGS_SUCCEEDED:
            return assign({}, state, action.data);

        case UPDATE_SETTINGS_SUCCEEDED:
            return assign({}, state, action.settings);

        default:
            return state;
    }

};

const sourceTypesInitialState = {
    value: ""
};

const sourceTypesReducer = (state = sourceTypesInitialState, action) => {
    switch (action.type) {

        case SET_SOURCE_TYPE_VALUE:
            return assign({}, state, {value: action.value});

        default:
            return state;
    }
};

const internalControlInitialState = {
    readaheadTerm: "",
    pendingReadahead: false,

    sourceType: "",
    sourceTypePending: false
};

const internalControlReducer = (state = internalControlInitialState, action) => {
    switch (action.type) {

        case GET_CONTROL_READAHEAD_REQUESTED:
            return assign({}, state, {
                readaheadTerm: action.term,
                pendingReadahead: true
            });

        case GET_CONTROL_READAHEAD_SUCCEEDED:
            return assign({}, state, {
                readahead: action.data,
                readaheadTerm: "",
                pendingReadahead: false
            });

        case SET_SOURCE_TYPE_VALUE:
            return assign({}, state, {

            });

        default:
            return state;

    }
};

const rootReducer = combineReducers({
    data: dataReducer,
    sourceTypes: sourceTypesReducer,
    internalControl: internalControlReducer
});

export default rootReducer;
