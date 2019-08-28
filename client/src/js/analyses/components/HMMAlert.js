import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";

import { Link } from "react-router-dom";
import { Icon, WarningAlert } from "../../base";

export const AnalysisHMMAlert = ({ installed }) => {
    if (installed) {
        return null;
    }

    return (
        <WarningAlert level>
            <Icon name="info-circle" />
            <span>
                <span>HMM data is not installed. </span>
                <Link to="/hmm">Install HMMs</Link>
                <span> to run NuV analyses.</span>
            </span>
        </WarningAlert>
    );
};

export const mapStateToProps = state => ({
    installed: !!get(state, "hmms.status.installed")
});

export default connect(mapStateToProps)(AnalysisHMMAlert);
