import { get } from "lodash-es";
import { WS_UPDATE_PROCESS, WS_UPDATE_STATUS, GET_SOFTWARE_UPDATES } from "../app/actionTypes";

export const initialState = {
    process: null,
    releases: null,
    showInstallModal: false
};

export default function updatesReducer(state = initialState, action) {
    switch (action.type) {
        case WS_UPDATE_PROCESS:
            if (action.data.id === get(state, "process.id")) {
                return { ...state, process: action.data };
            }

            return state;

        case WS_UPDATE_STATUS:
            if (action.data.id === "software") {
                return { ...state, ...action.data };
            }

            return state;

        case GET_SOFTWARE_UPDATES.SUCCEEDED:
            return { ...state, ...action.data };

        default:
            return state;
    }
}
