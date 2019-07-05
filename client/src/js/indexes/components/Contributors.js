import { map } from "lodash-es";
import React from "react";
import { Badge, ListGroup, ListGroupItem, Panel } from "react-bootstrap";
import { connect } from "react-redux";
import { PanelBadgeHeader } from "./General";

export const Contributor = ({ id, count }) => (
    <ListGroupItem key={id}>
        {id}
        <Badge>
            {count} change{count === 1 ? "" : "s"}
        </Badge>
    </ListGroupItem>
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
