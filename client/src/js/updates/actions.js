import { simpleActionCreator } from "../utils";
import { GET_SOFTWARE_UPDATES, INSTALL_SOFTWARE_UPDATES } from "../actionTypes";

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
