import { GET_CONTROL_READAHEAD, GET_SETTINGS, TEST_PROXY, UPDATE_SETTINGS } from "../app/actionTypes";

export const initialState = {
    data: null,
    readahead: null,
    readaheadPending: false,
    proxyTestPending: false,
    proxyTestSucceeded: false,
    proxyTestFailed: false
};

export const proxyTestClear = {
    proxyTestPending: false,
    proxyTestSucceeded: false,
    proxyTestFailed: false
};

export default function settingsReducer(state = initialState, action) {
    switch (action.type) {
        case GET_SETTINGS.SUCCEEDED:
            return { ...state, data: action.data, ...proxyTestClear };

        case UPDATE_SETTINGS.SUCCEEDED:
            return {
                ...state,
                data: { ...state.data, ...action.update },
                ...proxyTestClear
            };

        case UPDATE_SETTINGS.FAILED:
            return {
                ...state,
                data: {
                    ...state.data
                },
                ...proxyTestClear
            };

        case GET_CONTROL_READAHEAD.REQUESTED:
            return { ...state, readaheadPending: true };

        case GET_CONTROL_READAHEAD.SUCCEEDED:
            return { ...state, readahead: action.data, readaheadPending: false };

        case GET_CONTROL_READAHEAD.FAILED:
            return { ...state, readaheadPending: false };

        case TEST_PROXY.REQUESTED:
            return { ...state, ...proxyTestClear, proxyTestPending: true };

        case TEST_PROXY.SUCCEEDED:
            return { ...state, ...proxyTestClear, proxyTestSucceeded: true };

        case TEST_PROXY.FAILED:
            return { ...state, ...proxyTestClear, proxyTestFailed: true };

        default:
            return state;
    }
}
