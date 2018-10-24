import {
  WS_INSERT_USER,
  WS_UPDATE_USER,
  WS_REMOVE_USER,
  LIST_USERS,
  FILTER_USERS,
  GET_USER,
  CREATE_USER,
  EDIT_USER
} from "../actionTypes";
import { updateDocuments, insert, edit, remove } from "../reducerUtils";

export const initialState = {
  list: null,
  detail: null,
  createPending: false,
  passwordPending: false,
  fetched: false,
  refetchPage: false,
  filter: ""
};

const reducer = (state = initialState, action) => {
  switch (action.type) {
    case WS_INSERT_USER:
      if (!state.fetched) {
        return state;
      }
      return {
        ...state,
        list: {
          ...state.list,
          documents: insert(
            state.list.documents,
            state.list.page,
            state.list.per_page,
            action,
            "id"
          )
        }
      };

    case WS_UPDATE_USER:
      if (!state.list) {
        return state;
      }
      return {
        ...state,
        list: {
          ...state.list,
          documents: edit(state.list.documents, action)
        }
      };

    case WS_REMOVE_USER:
      if (!state.list) {
        return state;
      }
      return {
        ...state,
        list: {
          ...state.list,
          documents: remove(state.list.documents, action)
        },
        refetchPage: state.list.page < state.list.page_count
      };

    case LIST_USERS.REQUESTED:
      return { ...state, isLoading: true, errorLoad: false };

    case LIST_USERS.SUCCEEDED: {
      const documents = state.list ? state.list.documents : null;
      const page = state.list ? state.list.page : 0;
      return {
        ...state,
        list: updateDocuments(documents, action, page),
        isLoading: false,
        errorLoad: false,
        fetched: true,
        refetchPage: false
      };
    }

    case LIST_USERS.FAILED:
      return { ...state, isLoading: false, errorLoad: true };

    case FILTER_USERS.REQUESTED:
      return { ...state, filter: action.term };

    case FILTER_USERS.SUCCEEDED: {
      return { ...state, list: action.data };
    }

    case GET_USER.REQUESTED:
      return { ...state, detail: null };

    case GET_USER.SUCCEEDED:
      return { ...state, detail: action.data };

    case CREATE_USER.REQUESTED:
      return { ...state, createPending: true };

    case CREATE_USER.SUCCEEDED:
    case CREATE_USER.FAILED:
      return { ...state, createPending: false };

    case EDIT_USER.REQUESTED: {
      if (action.update.password) {
        return { ...state, passwordPending: true };
      }
      return state;
    }

    case EDIT_USER.SUCCEEDED:
      return { ...state, detail: action.data };

    default:
      return state;
  }
};

export default reducer;
