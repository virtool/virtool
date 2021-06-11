import { forEach } from "lodash-es";

export const workflowStates = {
    NONE: "none",
    PENDING: "pending",
    READY: "ready"
};

export const getDataTypeFromLibraryType = libraryType => {
    if (libraryType === "amplicon") {
        return "barcode";
    }

    return "genome";
};

const libraryTypes = {
    normal: "Normal",
    srna: "sRNA",
    amplicon: "Amplicon"
};

export const getLibraryTypeDisplayName = libraryType => libraryTypes[libraryType];

export const setWorkflowFindParameters = (url, workflow, conditions) => {
    if (conditions.length === 0 || conditions.length === 3) {
        url.searchParams.delete(workflow);
    } else {
        url.searchParams.set(workflow, conditions);
    }
};

export const createFindURL = (term, labels, workflows) => {
    const url = new window.URL(window.location);

    url.searchParams.delete("find");

    if (term) {
        url.searchParams.set("find", term);
    }

    url.searchParams.delete("label");
    labels.forEach(label => url.searchParams.append("label", label));

    url.searchParams.delete("workflows");

    const workflowFilters = [];

    forEach(workflows, (conditions, workflow) => {
        if (conditions.length) {
            forEach(conditions, condition => workflowFilters.push(`${workflow}:${condition}`));
        }
    });

    if (workflowFilters.length) {
        url.searchParams.set("workflows", workflowFilters.join(" "));
    }

    return url;
};
