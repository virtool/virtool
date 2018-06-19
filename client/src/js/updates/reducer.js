import { get } from "lodash-es";
import {
    WS_UPDATE_PROCESS,
    WS_UPDATE_STATUS,
    GET_SOFTWARE_UPDATES,
    SHOW_INSTALL_MODAL,
    HIDE_INSTALL_MODAL
} from "../actionTypes";

export const initialState = {
    process: null,
    releases: null,
    showInstallModal: false
};

export default function updatesReducer (state = initialState, action) {

    switch (action.type) {

        case WS_UPDATE_PROCESS:
            if (action.data.id === get(state, "process.id")) {
                return {...state, process: action.data};
            }

            return state;

        case WS_UPDATE_STATUS:
            if (action.data.id === "software") {
                return {...state, ...action.data};
            }

            return state;

        case GET_SOFTWARE_UPDATES.SUCCEEDED:
            return {...state, ...action.data};

        case SHOW_INSTALL_MODAL:
            return {...state, showInstallModal: true};

        case HIDE_INSTALL_MODAL:
            return {...state, showInstallModal: false};

        default:
            return state;
    }

}
