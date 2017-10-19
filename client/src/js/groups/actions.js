/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { LIST_GROUPS } from "../actionTypes";

export const listGroups = () => {
    return {
        type: LIST_GROUPS.REQUESTED
    };
};
