import React from "react";
import { connect } from "react-redux";
import { NarrowContainer } from "../../../base";
import SourceTypes from "../SourceTypes";
import ReferenceDetailHeader from "./Header";
import ReferenceMembers from "./Members";
import RemoveReference from "./Remove";
import ReferenceDetailTabs from "./Tabs";

export const ReferenceSettings = ({ isRemote }) => (
    <React.Fragment>
        <ReferenceDetailHeader />
        <ReferenceDetailTabs />
        <NarrowContainer>
            {isRemote ? null : <SourceTypes />}
            <ReferenceMembers noun="user" />
            <ReferenceMembers noun="group" />
            <RemoveReference />
        </NarrowContainer>
    </React.Fragment>
);

export const mapStateToProps = state => ({
    isRemote: !!state.references.detail.remotes_from
});

export default connect(mapStateToProps)(ReferenceSettings);
