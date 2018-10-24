import { sortBy, unionBy, concat } from "lodash-es";
import {
  WS_INSERT_GROUP,
  WS_UPDATE_GROUP,
  WS_REMOVE_GROUP,
  LIST_GROUPS,
  CREATE_GROUP,
  SET_GROUP_PERMISSION,
  REMOVE_GROUP
} from "../actionTypes";
import { edit, remove } from "../reducerUtils";

export const initialState = {
  list: null,
  fetched: false,
  pending: false,
  createError: false
};

export const updateGroup = (state, update) => ({
  ...state,
  pending: false,
  list: sortBy(unionBy([update], state.list, "id"), "id")
});

export const insertGroup = (list, entry) => sortBy(concat(list, [entry]), "id");

export default function groupsReducer(state = initialState, action) {
  switch (action.type) {
    case WS_INSERT_GROUP:
      if (!state.fetched) {
        return state;
      }
      return {
        ...state,
        list: insertGroup(state.list, action.data)
      };

    case WS_UPDATE_GROUP:
      return {
        ...state,
        list: edit(state.list, action)
      };

    case WS_REMOVE_GROUP:
      return {
        ...state,
        list: remove(state.list, action)
      };

    case LIST_GROUPS.SUCCEEDED:
      return { ...state, list: action.data, fetched: true };

    case CREATE_GROUP.REQUESTED:
    case REMOVE_GROUP.REQUESTED:
    case SET_GROUP_PERMISSION.REQUESTED:
      return { ...state, pending: true };

    case CREATE_GROUP.SUCCEEDED:
    case REMOVE_GROUP.SUCCEEDED:
    case SET_GROUP_PERMISSION.SUCCEEDED:
      return { ...state, pending: false };

    case CREATE_GROUP.FAILED:
      if (action.message === "Group already exists") {
        return { ...state, createError: true, pending: false };
      }
      return state;

    default:
      return state;
  }
}
