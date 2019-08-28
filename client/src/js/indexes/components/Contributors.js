import { map } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { ListGroup, ListGroupItem, Panel } from "react-bootstrap";
import { connect } from "react-redux";
import { Badge } from "../../base";
import { PanelBadgeHeader } from "./General";

const StyledContributor = styled(ListGroupItem)`
    display: flex;
    justify-content: space-between;
`;

export const Contributor = ({ id, count }) => (
    <StyledContributor key={id}>
        {id}
        <Badge>
            {count} change{count === 1 ? "" : "s"}
        </Badge>
    </StyledContributor>
);

export const Contributors = ({ contributors }) => {
    const contributorComponents = map(contributors, contributor => (
        <Contributor key={contributor.id} {...contributor} />
    ));

    return (
        <Panel>
            <Panel.Heading>
                <PanelBadgeHeader title="Contributors" count={contributors.length} />
            </Panel.Heading>
            <ListGroup>{contributorComponents}</ListGroup>
        </Panel>
    );
};

export const mapStateToProps = state => ({
    contributors: state.indexes.detail.contributors
});

export default connect(mapStateToProps)(Contributors);
