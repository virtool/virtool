import React from "react";
import { connect } from "react-redux";
import { Badge, TabLink, Tabs } from "../../../base";

export const ReferenceDetailTabs = ({ id, otuCount }) => (
    <Tabs>
        <TabLink to={`/refs/${id}/manage`}>Manage</TabLink>
        <TabLink to={`/refs/${id}/otus`}>
            OTUs <Badge>{otuCount}</Badge>
        </TabLink>
        <TabLink to={`/refs/${id}/indexes`}>Indexes</TabLink>
        <TabLink to={`/refs/${id}/settings`}>Settings</TabLink>
    </Tabs>
);

export const mapStateToProps = state => ({
    id: state.references.detail.id,
    otuCount: state.references.detail.otu_count
});

export default connect(mapStateToProps)(ReferenceDetailTabs);
