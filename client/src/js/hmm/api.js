import Request from "superagent";

const hmmsAPI = {

    find: () => (
        Request.get(`/api/hmms${window.location.search}`)
    ),

    install: () => (
        Request.post("/api/hmms")
    ),

    get: ({ hmmId }) => (
        Request.get(`/api/hmms/annotations/${hmmId}`)
    )

};

export default hmmsAPI;
