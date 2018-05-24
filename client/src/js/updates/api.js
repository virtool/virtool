import Request from "superagent";

export const getSoftware = () => (
    Request.get("/api/status/software")
);

export const installSoftwareUpdates = () => (
    Request.post("/api/status/software")
);
