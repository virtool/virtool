import Request from "superagent";

export const getSoftware = () => (
    Request.get("/api/updates/software")
);

export const getDatabase = () => (
    Request.get("/api/updates/database")
);

export const installSoftwareUpdates = () => (
    Request.post("/api/updates/software")
);
