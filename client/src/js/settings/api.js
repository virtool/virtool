import Request from "superagent";

const settingsAPI = {

    get: () => (
        Request.get("/api/settings")
    ),

    update: ({ update }) => (
        Request.patch("/api/settings")
            .send(update)
    )

};

export default settingsAPI;
