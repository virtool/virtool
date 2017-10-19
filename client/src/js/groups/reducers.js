/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign } from "lodash";
import { LIST_GROUPS } from "../actionTypes";

const initialState = {
    list: null
};

const reducer = (state = initialState, action) => {
    switch (action.type) {

        case LIST_GROUPS.SUCCEEDED:
            return assign({}, state, {list: action.data});

        default:
            return state;

    }
};

export default reducer;
