import Request from "superagent";

const hmmsAPI = {

    find: (term, page) => {
        const query = {
            page: page || 1
        };

        if (term) {
            query.term = term;
        }

        return Request
            .get("/api/hmms")
            .query(query);
    },

    install: () => (
        Request.post("/api/hmms")
    ),

    get: (hmmId) => (
        Request.get(`/api/hmms/annotations/${hmmId}`)
    )

};

export default hmmsAPI;
