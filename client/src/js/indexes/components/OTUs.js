import React from "react";
import styled from "styled-components";
import { map } from "lodash-es";
import { ListGroup, ListGroupItem, Panel } from "react-bootstrap";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { Badge } from "../../base";
import { PanelBadgeHeader } from "./General";

const StyledIndexOTU = styled(ListGroupItem)`
    display: flex;
    justify-content: space-between;
`;

export const IndexOTU = ({ refId, changeCount, id, name }) => (
    <StyledIndexOTU>
        <Link to={`/refs/${refId}/otus/${id}`}>{name}</Link>
        <Badge>
            {changeCount} {`change${changeCount > 1 ? "s" : ""}`}
        </Badge>
    </StyledIndexOTU>
);

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
