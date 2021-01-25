import React from "react";
import { connect } from "react-redux";
import SourceTypes from "../SourceTypes";
import ReferenceMembers from "./Members";
import RemoveReference from "./Remove";

export const ReferenceSettings = ({ isRemote }) => (
    <React.Fragment>
        {isRemote ? null : <SourceTypes />}
        <ReferenceMembers noun="user" />
        <ReferenceMembers noun="group" />
        <RemoveReference />
    </React.Fragment>
);

export const mapStateToProps = state => ({
    isRemote: !!state.references.detail.remotes_from
});

export default connect(mapStateToProps)(ReferenceSettings);
