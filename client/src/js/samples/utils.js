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

export const createFindURL = (term, labels, pathoscope, nuvs) => {
    const url = new window.URL(window.location);

    if (term) {
        url.searchParams.set("find", term);
    } else {
        url.searchParams.delete("find");
    }

    url.searchParams.delete("label");
    labels.forEach(label => url.searchParams.append("label", label));

    setWorkflowFindParameters(url, "pathoscope", pathoscope);
    setWorkflowFindParameters(url, "nuvs", nuvs);

    return url;
};
