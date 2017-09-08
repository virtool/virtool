/**
 * Actions and action creators for working with administrative settings.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import {
    WS_UPDATE_STATUS,
    GET_SOFTWARE_UPDATES,
    GET_DATABASE_UPDATES,
    INSTALL_SOFTWARE_UPDATES,
    SHOW_INSTALL_MODAL,
    HIDE_INSTALL_MODAL
} from "../actionTypes";

export function wsUpdateStatus (data) {
    return {
        type: WS_UPDATE_STATUS,
        data
    };
}

export function getSoftwareUpdates () {
    return {
        type: GET_SOFTWARE_UPDATES.REQUESTED
    }
}

export function installSoftwareUpdates () {
    return {
        type: INSTALL_SOFTWARE_UPDATES.REQUESTED
    };
}

export function getDatabaseUpdates () {
    return {
        type: GET_DATABASE_UPDATES.REQUESTED
    }
}

export function showInstallModal () {
    return {
        type: SHOW_INSTALL_MODAL
    };
}

export function hideInstallModal () {
    return {
        type: HIDE_INSTALL_MODAL
    };
}
