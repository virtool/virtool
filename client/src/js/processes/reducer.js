import { map } from "lodash-es";
import {
  WS_INSERT_PROCESS,
  WS_UPDATE_PROCESS,
  LIST_PROCESSES,
  GET_PROCESS
} from "../actionTypes";

export const initialState = {
  documents: [],
  detail: null
};

export const updateProcesses = (state, action) => {
  if (!state.documents.length) {
    return {
      ...state,
      documents: [{ ...action.data }]
    };
  }

  return {
    ...state,
    documents: map(
      state.documents,
      doc => (doc.id === action.data.id ? { ...doc, ...action.data } : doc)
    )
  };
};

export default function processReducer(state = initialState, action) {
  switch (action.type) {
    case WS_INSERT_PROCESS:
      return { ...state, documents: [...state.documents, action.data] };

    case WS_UPDATE_PROCESS:
      return updateProcesses(state, action);

    case LIST_PROCESSES.SUCCEEDED:
      return { ...state, documents: [...action.data] };

    case GET_PROCESS.REQUESTED:
      return { ...state, detail: null };

    case GET_PROCESS.SUCCEEDED:
      return { ...state, detail: action.data };

    default:
      return state;
  }
}
