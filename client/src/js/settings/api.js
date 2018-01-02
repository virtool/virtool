import Request from "superagent";

const settingsAPI = {

    get: () => (
        Request.get("/api/settings")
    ),

    update: (update) => (
        Request.patch("/api/settings", update)
    )

};

export default settingsAPI;
