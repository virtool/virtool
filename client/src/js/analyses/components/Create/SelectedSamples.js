import React from "react";
import styled from "styled-components";
import { map } from "lodash-es";

import { Badge, ListGroup } from "react-bootstrap";
import { ListGroupItem } from "../../../base";

export const SelectedSamplesLabel = ({ count }) => {
    let tail;

    if (count > 1) {
        tail = (
            <React.Fragment>
                s <Badge>{count}</Badge>
            </React.Fragment>
        );
    }

    return <label className="control-label">Sample{tail}</label>;
};

const SelectedSamplesListGroupContainer = styled(ListGroup)`
    margin-bottom: 16px;
    max-height: 220px;
    overflow-y: ${props => (props.count > 1 ? "scroll" : "auto")};

    div {
        margin-bottom: 0;
    }
`;

export const SelectedSamples = ({ samples }) => {
    const count = samples.length;

    const sampleComponents = map(samples, ({ id, name }) => (
        <ListGroupItem key={id} disabled>
            {name}
        </ListGroupItem>
    ));

    return (
        <React.Fragment>
            <SelectedSamplesLabel count={count} />
            <SelectedSamplesListGroupContainer count={count}>
                <ListGroup>{sampleComponents}</ListGroup>
            </SelectedSamplesListGroupContainer>
        </React.Fragment>
    );
};
