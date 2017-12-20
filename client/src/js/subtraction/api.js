import Request from "superagent";

const subtractionAPI = {

    find: () => (
        Request.get(`/api/subtraction${window.location.search}`)
    ),

    listIds: () => (
        Request.get("/api/subtraction")
            .query({ids: true})
    ),

    get: ({ subtractionId }) => (
        Request.get(`/api/subtraction/${subtractionId}`)
    ),

    create: ({ subtractionId, fileId }) => (
        Request.post("/api/subtraction")
            .send({
                subtraction_id: subtractionId,
                file_id: fileId
            })
    ),

    remove: ({ subtractionId }) => (
        Request.delete(`/api/subtraction/${subtractionId}`)
    )

};

export default subtractionAPI;
