export const setWorkflowFindParameters = (url, workflow, conditions) => {
    if (conditions.length === 0 || conditions.length === 3) {
        url.searchParams.delete(workflow);
    } else {
        url.searchParams.set(workflow, conditions);
    }
};

export const createFindURL = (term, pathoscope, nuvs) => {
    const url = new window.URL(window.location);

    if (term !== undefined) {
        if (term) {
            url.searchParams.set("find", term);
        } else {
            url.searchParams.delete("find");
        }
    }

    setWorkflowFindParameters(url, "pathoscope", pathoscope);
    setWorkflowFindParameters(url, "nuvs", nuvs);

    return url;
};
