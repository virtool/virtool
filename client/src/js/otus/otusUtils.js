export const getNextState = (prevError, nextError) => {
    if (prevError !== nextError) {
        if (nextError === "Name already exists") {
            return { errorName: nextError, error: nextError };
        } else if (nextError === "Abbreviation already exists") {
            return { errorAbbreviation: nextError, error: nextError };
        } else if (!nextError.length) {
            return { error: "" };
        }
        return {
            errorName: "Name already exists",
            errorAbbreviation: "Abbrevation already exists",
            error: nextError
        };
    }
    return null;
};
