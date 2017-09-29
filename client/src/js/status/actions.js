/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */
import { WS_UPDATE_STATUS } from "../actionTypes";

export function wsUpdateStatus (data) {
    return {
        type: WS_UPDATE_STATUS,
        data
    };
}
