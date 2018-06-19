import Request from "superagent";

export const getSoftware = () => (
    Request.get("/api/software")
);

export const installSoftwareUpdates = () => (
    Request.post("/api/software")
);
