import { reject, sortBy, unionBy } from "lodash-es";
import { LIST_GROUPS, CREATE_GROUP, SET_GROUP_PERMISSION, REMOVE_GROUP } from "../actionTypes";

const initialState = {
    list: null,
    pending: false,
    createError: false
};

export const updateGroup = (state, update) => ({
    ...state,
    pending: false,
    list: sortBy(unionBy([update], state.list, "id"), "id")
});

export default function groupsReducer (state = initialState, action) {
    switch (action.type) {

        case LIST_GROUPS.SUCCEEDED:
            return {...state, list: action.data};

        case CREATE_GROUP.REQUESTED:
        case REMOVE_GROUP.REQUESTED:
        case SET_GROUP_PERMISSION.REQUESTED:
            return {...state, pending: true};

        case CREATE_GROUP.SUCCEEDED:
        case SET_GROUP_PERMISSION.SUCCEEDED:
            return updateGroup(state, action.data);

        case CREATE_GROUP.FAILED:
            if (action.message === "Group already exists") {
                return {...state, createError: true, pending: false};
            }

            return state;

        case REMOVE_GROUP.SUCCEEDED:
            return {...state, pending: false, list: reject(state.list, {id: action.id})};

        default:
            return state;

    }
}
