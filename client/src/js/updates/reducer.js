import { get } from "lodash-es";
import { GET_SOFTWARE_UPDATES, WS_UPDATE_STATUS, WS_UPDATE_TASK } from "../app/actionTypes";

export const initialState = {
    task: null,
    releases: null,
    showInstallModal: false
};

export default function updatesReducer(state = initialState, action) {
    switch (action.type) {
        case WS_UPDATE_TASK:
            if (action.data.id === get(state, "task.id")) {
                return { ...state, task: action.data };
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
