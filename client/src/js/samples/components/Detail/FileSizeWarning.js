import { endsWith } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { Alert, Icon } from "../../../base";
import { getFilesUndersized } from "../../selectors";

export const SampleFileSizeWarning = ({ sampleId, show, showLink }) => {
    if (show) {
        let link = "Check the file sizes";

        if (showLink) {
            link = <Link to={`/samples/${sampleId}/files`}>{link}</Link>;
        }

        return (
            <Alert color="orange" level>
                <Icon name="exclamation-triangle" />
                <span>
                    <strong>The read files in this sample are smaller than expected. </strong>
                    <span>{link} and ensure they are correct.</span>
                </span>
            </Alert>
        );
    }

    return null;
};

export const mapStateToProps = state => ({
    sampleId: state.samples.detail.id,
    show: getFilesUndersized(state),
    showLink: !endsWith(state.router.location.pathname, "/files")
});

export default connect(mapStateToProps)(SampleFileSizeWarning);
