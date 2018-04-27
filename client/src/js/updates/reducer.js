import {
    WS_UPDATE_STATUS,
    GET_SOFTWARE_UPDATES,
    GET_DATABASE_UPDATES,
    SHOW_INSTALL_MODAL,
    HIDE_INSTALL_MODAL
} from "../actionTypes";

export const initialState = {
    software: null,
    database: null,
    showInstallModal: false
};

export default function updatesReducer (state = initialState, action) {

    switch (action.type) {

        case WS_UPDATE_STATUS:
            if (action.data.id === "software_update") {
                return {...state, software: action.data};
            }

            return state;

        case GET_SOFTWARE_UPDATES.SUCCEEDED:
            return {...state, software: action.data};

        case GET_DATABASE_UPDATES.SUCCEEDED:
            return {...state, database: action.data};

        case SHOW_INSTALL_MODAL:
            return {...state, showInstallModal: true};

        case HIDE_INSTALL_MODAL:
            return {...state, showInstallModal: false};

        default:
            return state;
    }

}
