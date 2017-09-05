/**
 * Actions and action creators for working with administrative settings.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import {
    GET_SOFTWARE_UPDATES,
    GET_DATABASE_UPDATES
} from "../actionTypes";

export function getSoftwareUpdates () {
    return {
        type: GET_SOFTWARE_UPDATES.REQUESTED
    }
}

export function getDatabaseUpdates () {
    return {
        type: GET_DATABASE_UPDATES.REQUESTED
    }
}
