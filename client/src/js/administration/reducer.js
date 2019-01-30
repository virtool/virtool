import { GET_CONTROL_READAHEAD, GET_SETTINGS, TEST_PROXY, UPDATE_SETTINGS } from "../app/actionTypes";

export const initialState = {
    data: null,
    readahead: null,
    readaheadPending: false
};

export default function settingsReducer(state = initialState, action) {
    switch (action.type) {
        case GET_SETTINGS.SUCCEEDED:
            return { ...state, data: action.data };

        case UPDATE_SETTINGS.SUCCEEDED:
            return {
                ...state,
                data: { ...state.data, ...action.update }
            };

        case GET_CONTROL_READAHEAD.REQUESTED:
            return { ...state, readaheadPending: true };

        case GET_CONTROL_READAHEAD.SUCCEEDED:
            return { ...state, readahead: action.data, readaheadPending: false };

        case GET_CONTROL_READAHEAD.FAILED:
            return { ...state, readaheadPending: false };

        default:
            return state;
    }
}
