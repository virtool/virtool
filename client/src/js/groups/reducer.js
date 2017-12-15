/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { reject, sortBy, unionBy } from "lodash";
import { LIST_GROUPS, CREATE_GROUP, SET_GROUP_PERMISSION, REMOVE_GROUP } from "../actionTypes";

const initialState = {
    documents: null,
    pending: false,
    createError: false
};

const updateGroup = (state, update) => {
    return {...state, pending: false, list: sortBy(unionBy([update], state.list, "id"), "id")};
};

export default function groupsReducer (state = initialState, action) {
    switch (action.type) {

        case LIST_GROUPS.SUCCEEDED:
            return {...state, documents: action.data};

        case CREATE_GROUP.REQUESTED:
        case REMOVE_GROUP.REQUESTED:
        case SET_GROUP_PERMISSION.REQUESTED:
            return {...state, pending: true};

        case CREATE_GROUP.SUCCEEDED:
        case SET_GROUP_PERMISSION.SUCCEEDED:
            return updateGroup(state, action.data);

        case CREATE_GROUP.FAILED:
            return {...state, createError: true, pending: false};

        case REMOVE_GROUP.SUCCEEDED:
            return {...state, pending: false, list: reject(state.list, {id: action.id})};

        default:
            return state;

    }
}
