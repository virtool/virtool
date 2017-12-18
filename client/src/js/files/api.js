import Request from "superagent";

const filesAPI = {

    find: (fileType, page) => (
        Request.get("/api/files")
            .query({
                type: fileType,
                page
            })
    ),

    remove: (fileId) => (
        Request.delete(`/api/files/${fileId}`)
    ),

    upload: (file, fileType, onProgress) => (
        Request.post(`/upload/${fileType}`)
            .query({name: file.name})
            .attach("file", file)
            .on("progress", onProgress)
    )
};

export default filesAPI;
