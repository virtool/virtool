/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign, reject, sortBy, unionBy } from "lodash";
import { LIST_GROUPS, CREATE_GROUP, SET_GROUP_PERMISSION, REMOVE_GROUP } from "../actionTypes";

const initialState = {
    list: null,
    pending: false
};

const updateGroup = (state, update) => {
    return assign({}, state, {pending: false}, {list: sortBy(unionBy([update], state.list, "id"), "id")});
};

const reducer = (state = initialState, action) => {
    switch (action.type) {

        case LIST_GROUPS.SUCCEEDED:
            return assign({}, state, {list: sortBy(action.data, "id")});

        case CREATE_GROUP.REQUESTED:
        case REMOVE_GROUP.REQUESTED:
        case SET_GROUP_PERMISSION.REQUESTED:
            return assign({}, state, {pending: true});

        case CREATE_GROUP.SUCCEEDED:
        case SET_GROUP_PERMISSION.SUCCEEDED:
            return updateGroup(state, action.data);

        case REMOVE_GROUP.SUCCEEDED:
            return assign({}, state, {pending: false, list: reject(state.list, {id: action.id})});

        default:
            return state;

    }
};

export default reducer;
