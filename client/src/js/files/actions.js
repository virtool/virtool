/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { FIND_FILES, REMOVE_FILE } from "../actionTypes";

export function findFiles () {
    return {
        type: FIND_FILES.REQUESTED
    };
}

export function removeFile (fileId) {
    return {
        type: REMOVE_FILE,
        fileId
    };
}
