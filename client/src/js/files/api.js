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

    find: (fileType) => {
        return Request.get("/api/files")
            .query({type: fileType});
    },

    remove: (fileId) => {
        return Request.delete(`/api/files/${fileId}`);
    },

    upload: (file, fileType, onProgress) => {
        return Request.post(`/upload/${fileType}`)
            .query({name: file.name})
            .attach("file", file)
            .on("progress", onProgress);
    }
};



export default filesAPI;
