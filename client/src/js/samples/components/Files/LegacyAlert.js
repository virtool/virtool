import { connect } from "react-redux";
import React from "react";
import { Alert } from "react-bootstrap";
import { getHasRawFilesOnly } from "../../selectors";

export const SampleFilesLegacyAlert = ({ show }) => {
    if (show) {
        return (
            <Alert bsStyle="warning">
                <p className="text-strong">
                    Virtool now retains raw data for newly created samples instead of trimming during sample creation.
                </p>
                <p>
                    Because this is an older sample, only trimmed data is available. You can upload the original sample
                    files by dragging them onto the trimmed files they should replace.
                </p>
                <p>
                    When replacements have been uploaded for all data files, an update job will start. No new analyses
                    can be started for the sample during this time.
                </p>

                <p>
                    <a target="_blank" rel="noopener noreferrer" href="https://www.virtool.ca/docs">
                        More information
                    </a>
                </p>
            </Alert>
        );
    }

    return null;
};

const mapStateToProps = state => ({
    show: !getHasRawFilesOnly(state)
});

export default connect(mapStateToProps)(SampleFilesLegacyAlert);
