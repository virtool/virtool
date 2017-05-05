/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { GET_ACCOUNT_REQUESTED } from "./actionTypes";

export function getAccount() {
    return {
        type: GET_ACCOUNT_REQUESTED
    }
}
