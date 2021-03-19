import React from "react";
import { connect } from "react-redux";
import { Alert } from "../../base";
import { getHasRawFilesOnly } from "../selectors";

export const SampleFilesLegacyAlert = () => (
    <Alert color="orange" block>
        <p>
            <strong>
                Virtool now retains raw data for newly created samples instead of trimming during sample creation.
            </strong>
        </p>
        <p>
            Because this is an older sample, only trimmed data is available. You can upload the original sample files by
            dragging them onto the trimmed files they should replace.
        </p>
    </Alert>
);

export const SampleFilesMessage = ({ showLegacy }) => {
    if (showLegacy) {
        return <SampleFilesLegacyAlert />;
    }

    return null;
};

const mapStateToProps = state => {
    const hasRawFilesOnly = getHasRawFilesOnly(state);

    return {
        showLegacy: !hasRawFilesOnly
    };
};

export default connect(mapStateToProps)(SampleFilesMessage);
