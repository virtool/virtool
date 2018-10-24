import {
  WS_INSERT_SUBTRACTION,
  WS_UPDATE_SUBTRACTION,
  WS_REMOVE_SUBTRACTION,
  LIST_SUBTRACTIONS,
  GET_SUBTRACTION,
  UPDATE_SUBTRACTION,
  FILTER_SUBTRACTIONS
} from "../actionTypes";
import { updateDocuments, insert, edit, remove } from "../reducerUtils";

export const initialState = {
  documents: null,
  page: 0,
  total_count: 0,
  detail: null,
  filter: "",
  fetched: false,
  refetchPage: false
};

export default function subtractionsReducer(state = initialState, action) {
  switch (action.type) {
    case WS_INSERT_SUBTRACTION:
      if (!state.fetched) {
        return state;
      }
      return {
        ...state,
        documents: insert(
          state.documents,
          state.page,
          state.per_page,
          action,
          "id"
        ),
        total_count: state.total_count + 1
      };

    case WS_UPDATE_SUBTRACTION:
      return {
        ...state,
        documents: edit(state.documents, action)
      };

    case WS_REMOVE_SUBTRACTION:
      return {
        ...state,
        documents: remove(state.documents, action),
        refetchPage: state.page < state.page_count,
        total_count: state.total_count - 1
      };

    case LIST_SUBTRACTIONS.REQUESTED:
      return { ...state, isLoading: true, errorLoad: false };

    case LIST_SUBTRACTIONS.SUCCEEDED: {
      return {
        ...state,
        ...updateDocuments(state.documents, action, state.page),
        isLoading: false,
        errorLoad: false,
        fetched: true,
        refetchPage: false
      };
    }

    case LIST_SUBTRACTIONS.FAILED:
      return { ...state, isLoading: false, errorLoad: true };

    case GET_SUBTRACTION.REQUESTED:
      return { ...state, detail: null };

    case GET_SUBTRACTION.SUCCEEDED:
      return { ...state, detail: action.data };

    case UPDATE_SUBTRACTION.SUCCEEDED:
      return { ...state, detail: action.data };

    case FILTER_SUBTRACTIONS.REQUESTED:
      return { ...state, filter: action.term };

    case FILTER_SUBTRACTIONS.SUCCEEDED: {
      return { ...state, ...action.data };
    }

    default:
      return state;
  }
}
