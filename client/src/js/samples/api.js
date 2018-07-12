import Request from "superagent";

export const find = () => (
    Request.get(`/api/samples${window.location.search}`)
);

export const fetch = ({ page }) => (
    Request.get(`/api/samples?page=${page}`)
);

export const findReadyHosts = () => (
    Request.get("/api/subtractions")
        .query({
            ready: true,
            is_host: true
        })
);

export const get = ({ sampleId }) => (
    Request.get(`/api/samples/${sampleId}`)
);

export const create = ({ name, isolate, host, locale, srna, subtraction, files }) => (
    Request.post("/api/samples")
        .send({
            name,
            isolate,
            host,
            locale,
            srna,
            subtraction,
            files
        })
);

export const update = ({ sampleId, update }) => (
    Request.patch(`/api/samples/${sampleId}`)
        .send(update)
);

export const updateRights = ({ sampleId, update }) => (
    Request.patch(`/api/samples/${sampleId}/rights`)
        .send(update)
);

export const remove = ({ sampleId }) => (
    Request.delete(`/api/samples/${sampleId}`)
);
