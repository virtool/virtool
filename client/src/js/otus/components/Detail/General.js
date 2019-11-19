import React from "react";
import { connect } from "react-redux";
import Issues from "./Issues";

export const OTUGeneral = ({ issues, isolates }) => {
    if (issues) {
        return <Issues issues={issues} isolates={isolates} />;
    }

    return null;
};

export const mapStateToProps = state => {
    const { issues, isolates } = state.otus.detail;
    return {
        issues,
        isolates
    };
};

export default connect(mapStateToProps)(OTUGeneral);
