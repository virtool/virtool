import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";

import { Link } from "react-router-dom";
import { Alert, Icon } from "../../base";

export const AnalysisHMMAlert = ({ installed }) => {
    if (installed) {
        return null;
    }

    return (
        <Alert color="orange" level>
            <Icon name="info-circle" />
            <span>
                <strong>HMM data is not installed. </strong>
                <Link to="/hmm">Install HMMs</Link>
                <span> to run NuV analyses.</span>
            </span>
        </Alert>
    );
};

export const mapStateToProps = state => ({
    installed: !!get(state, "hmms.status.installed")
});

export default connect(mapStateToProps)(AnalysisHMMAlert);
