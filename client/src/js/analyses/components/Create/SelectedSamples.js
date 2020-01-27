import React from "react";
import styled from "styled-components";
import { map } from "lodash-es";

import { ListGroupItem } from "../../../base";
import { SelectedSamplesLabel } from "./SelectedSamplesLabel";

const SelectedSamplesListGroupContainer = styled.div`
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
            <SelectedSamplesListGroupContainer count={count}>{sampleComponents}</SelectedSamplesListGroupContainer>
        </React.Fragment>
    );
};
