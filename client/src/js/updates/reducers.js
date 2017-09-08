import { assign } from "lodash";
import {
    WS_UPDATE_STATUS,
    GET_SOFTWARE_UPDATES,
    GET_DATABASE_UPDATES,
    SHOW_INSTALL_MODAL,
    HIDE_INSTALL_MODAL
} from "../actionTypes";

const initialState = {
    software: null,
    database: null,

    showInstallModal: false
};

const updatesReducer = (state = initialState, action) => {

    switch (action.type) {

        case WS_UPDATE_STATUS:
            if (action.data.id === "software_update") {
                return assign({}, state, {software: action.data});
            }
            break;

        case GET_SOFTWARE_UPDATES.SUCCEEDED:
            return assign({}, state, {software: action.data});

        case GET_DATABASE_UPDATES.SUCCEEDED:
            return assign({}, state, {database: action.data});

        case SHOW_INSTALL_MODAL:
            return assign({}, state, {showInstallModal: true});

        case HIDE_INSTALL_MODAL:
            return assign({}, state, {showInstallModal: false});

        default:
            return state;
    }

};

export default updatesReducer;
