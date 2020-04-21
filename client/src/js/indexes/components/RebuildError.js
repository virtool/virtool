import React from "react";
import { Alert } from "../../base";

export const RebuildIndexError = ({ error }) => {
    if (error) {
        const unverified = error === "There are unverified OTUs";

        return (
            <Alert color="red">
                <span>
                    <strong>
                        {error}
                        {unverified && "."}
                    </strong>
                    {unverified && <span> Fix the unverified OTUs before rebuilding the index.</span>}
                </span>
            </Alert>
        );
    }

    return null;
};
