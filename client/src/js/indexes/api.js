import Request from "superagent";

const indexesAPI = {

    find: () => (
        Request.get("/api/indexes")
    ),

    get: (indexVersion) => (
        Request.get(`/api/indexes/${indexVersion}`)
    ),

    getUnbuilt: () => (
        Request.get("/api/indexes/unbuilt")
    ),

    create: () => (
        Request.post("/api/indexes")
    ),

    getHistory: (indexVersion) => (
        Request.get(`/api/indexes/${indexVersion}/history`)
    )
};

export default indexesAPI;
