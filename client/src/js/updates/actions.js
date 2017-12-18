import { simpleActionCreator } from "../utils";
import {
    GET_SOFTWARE_UPDATES,
    INSTALL_SOFTWARE_UPDATES,
    SHOW_INSTALL_MODAL,
    HIDE_INSTALL_MODAL
} from "../actionTypes";

export const getSoftwareUpdates = simpleActionCreator(GET_SOFTWARE_UPDATES.REQUESTED);
export const installSoftwareUpdates = simpleActionCreator(INSTALL_SOFTWARE_UPDATES.REQUESTED);
export const showInstallModal = simpleActionCreator(SHOW_INSTALL_MODAL);
export const hideInstallModal = simpleActionCreator(HIDE_INSTALL_MODAL);
