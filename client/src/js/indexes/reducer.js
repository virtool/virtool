import {
  WS_INSERT_INDEX,
  WS_UPDATE_INDEX,
  LIST_INDEXES,
  GET_INDEX,
  GET_UNBUILT,
  GET_INDEX_HISTORY,
  WS_INSERT_HISTORY
} from "../actionTypes";
import { updateDocuments, insert, edit } from "../reducerUtils";

export const initialState = {
  referenceId: "",
  documents: null,
  page: 0,
  fetched: false,
  refetchPage: false,
  modified_count: 0,
  total_otu_count: 0,
  detail: null,
  history: null,
  unbuilt: null,
  showRebuild: false
};

export default function indexesReducer(state = initialState, action) {
  switch (action.type) {
    case WS_INSERT_HISTORY:
      if (action.data.reference.id === state.referenceId) {
        return { ...state, modified_otu_count: state.modified_otu_count + 1 };
      }
      return state;

    case WS_INSERT_INDEX:
      if (!state.fetched || action.data.reference.id !== state.referenceId) {
        return state;
      }
      return {
        ...state,
        documents: insert(
          state.documents,
          state.page,
          state.per_page,
          action,
          "version"
        ).reverse(),
        modified_otu_count: 0
      };

    case WS_UPDATE_INDEX:
      if (action.data.reference.id !== state.referenceId) {
        return state;
      }
      return {
        ...state,
        documents: edit(state.documents, action)
      };

    case LIST_INDEXES.REQUESTED:
      return {
        ...state,
        referenceId: action.refId,
        isLoading: true,
        errorLoad: false
      };

    case LIST_INDEXES.SUCCEEDED:
      return {
        ...state,
        ...updateDocuments(state.documents, action, state.page),
        isLoading: false,
        errorLoad: false,
        fetched: true,
        refetchPage: false
      };

    case LIST_INDEXES.FAILED:
      return { ...state, isLoading: false, errorLoad: true };

    case GET_INDEX.REQUESTED:
      return { ...state, detail: null };

    case GET_INDEX.SUCCEEDED:
      return { ...state, detail: action.data };

    case GET_UNBUILT.SUCCEEDED:
      return { ...state, unbuilt: action.data };

    case GET_INDEX_HISTORY.REQUESTED:
      return {
        ...state,
        history: {
          ...state.history,
          isLoading: true,
          errorLoad: false
        }
      };

    case GET_INDEX_HISTORY.SUCCEEDED:
      return {
        ...state,
        history: {
          ...state.history,
          ...updateDocuments(state.history.documents, action),
          isLoading: false,
          errorLoad: false
        }
      };

    case GET_INDEX_HISTORY.FAILED:
      return {
        ...state,
        history: {
          ...state.history,
          isLoading: false,
          errorLoad: true
        }
      };

    default:
      return state;
  }
}
