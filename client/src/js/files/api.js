/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import Request from "superagent";

const filesAPI = {

    find: () => {
        return Request.get("/api/files");
    }

};

export default filesAPI;
