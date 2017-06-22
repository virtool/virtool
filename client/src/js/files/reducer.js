/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign } from "lodash";

import { FIND_FILES, REMOVE_FILE } from "../actionTypes";

const initialState = {
    documents: null
};

export default function reducer (state = initialState, action) {

    switch (action.type) {

        case FIND_FILES.SUCCEEDED:
            console.log(action);
            return assign({}, state, {
                documents: action.data
            });

    }

    return state;
}
