import {
  WS_INSERT_JOB,
  WS_UPDATE_JOB,
  WS_REMOVE_JOB,
  LIST_JOBS,
  FILTER_JOBS,
  GET_JOB,
  GET_RESOURCES
} from "../actionTypes";
import { updateDocuments, insert, edit, remove } from "../reducerUtils";

export const initialState = {
  documents: null,
  page: 0,
  total_count: 0,
  detail: null,
  filter: "",
  fetched: false,
  refetchPage: false,
  resources: null
};

export default function jobsReducer(state = initialState, action) {
  switch (action.type) {
    case WS_INSERT_JOB:
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
          "created_at"
        ),
        total_count: state.total_count + 1
      };

    case WS_UPDATE_JOB:
      return {
        ...state,
        documents: edit(state.documents, action)
      };

    case WS_REMOVE_JOB:
      return {
        ...state,
        documents: remove(state.documents, action),
        refetchPage: state.page < state.page_count,
        total_count: state.total_count - 1
      };

    case LIST_JOBS.REQUESTED:
      return { ...state, isLoading: true, errorLoad: false };

    case LIST_JOBS.SUCCEEDED:
      return {
        ...state,
        ...updateDocuments(state.documents, action, state.page),
        isLoading: false,
        errorLoad: false,
        fetched: true,
        refetchPage: false
      };

    case LIST_JOBS.FAILED:
      return { ...state, isLoading: false, errorLoad: true };

    case FILTER_JOBS.REQUESTED:
      return { ...state, filter: action.term };

    case FILTER_JOBS.SUCCEEDED:
      return { ...state, ...action.data };

    case GET_JOB.REQUESTED:
      return { ...state, detail: null };

    case GET_JOB.SUCCEEDED:
      return { ...state, detail: action.data };

    case GET_RESOURCES.SUCCEEDED:
      return { ...state, resources: action.data };

    default:
      return state;
  }
}
