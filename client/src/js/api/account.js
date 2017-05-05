/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import Request from "superagent";

export const accountAPI = {

    get: () => {
        return Request.get("/api/account");
    }

};
