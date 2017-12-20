import Request from "superagent";

const updatesAPI = {

    getSoftware: () => (
        Request.get("/api/updates/software")
    ),

    getDatabase: () => (
        Request.get("/api/updates/database")
    ),

    installSoftwareUpdates: () => (
        Request.post("/api/updates/software")
    )
};

export default updatesAPI;
