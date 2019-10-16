import { map } from "lodash-es";
import React from "react";
import { ListGroup } from "react-bootstrap";
import { connect } from "react-redux";
import { Panel } from "../../base";
import { PanelBadgeHeader } from "./General";
import { IndexOTU } from "./OTU";

export const IndexOTUs = ({ otus, refId }) => {
    const otuComponents = map(otus, otu => (
        <IndexOTU key={otu.id} refId={refId} name={otu.name} id={otu.id} changeCount={otu.change_count} />
    ));

    return (
        <Panel>
            <Panel.Heading>
                <PanelBadgeHeader title="OTUs" count={otus.length} />
            </Panel.Heading>
            <ListGroup>{otuComponents}</ListGroup>
        </Panel>
    );
};

export const mapStateToProps = state => ({
    refId: state.indexes.detail.reference.id,
    otus: state.indexes.detail.otus
});

export default connect(mapStateToProps)(IndexOTUs);
