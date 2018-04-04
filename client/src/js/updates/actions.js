import { simpleActionCreator } from "../utils";
import {
    GET_SOFTWARE_UPDATES,
    INSTALL_SOFTWARE_UPDATES,
    SHOW_INSTALL_MODAL,
    HIDE_INSTALL_MODAL
} from "../actionTypes";

/**
 * Returns action that can trigger an API call for retrieving software udpates.
 *
 * @func
 * @returns {object}
 */
export const getSoftwareUpdates = simpleActionCreator(GET_SOFTWARE_UPDATES.REQUESTED);

/**
 * Returns action that can trigger an API call for installing software updates.
 *
 * @func
 * @returns {object}
 */
export const installSoftwareUpdates = simpleActionCreator(INSTALL_SOFTWARE_UPDATES.REQUESTED);

/**
 * Returns action for showing installation modal.
 *
 * @func
 * @returns {object}
 */
export const showInstallModal = simpleActionCreator(SHOW_INSTALL_MODAL);

/**
 * Returns action for hiding installation modal.
 *
 * @func
 * @returns {object}
 */
export const hideInstallModal = simpleActionCreator(HIDE_INSTALL_MODAL);
