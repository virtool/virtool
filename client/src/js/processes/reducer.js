import { map } from "lodash-es";
import {
    WS_UPDATE_PROCESS,
    LIST_PROCESSES,
    GET_PROCESS
} from "../actionTypes";

export const initialState = {
    documents: null,
    detail: null
};
export const updateProcess = (state, action) => ({
    ...state,
    documents: map(state.documents, doc => doc.id === action.data.id ? {...doc, ...action.data} : doc)
});

export default function referenceReducer (state = initialState, action) {

    switch (action.type) {

        case WS_UPDATE_PROCESS:
            return state.documents === null ? state : updateProcess(state, action);

        case LIST_PROCESSES.SUCCEEDED:
            return {...state, ...action.data};

        case GET_PROCESS.REQUESTED:
            return {...state, detail: null};

        case GET_PROCESS.SUCCEEDED:
            return {...state, detail: action.data};

        default:
            return state;
    }
}
