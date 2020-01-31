import React from "react";
import styled from "styled-components";
import { map } from "lodash-es";

import { BoxGroup, BoxGroupSection } from "../../../base";
import { SelectedSamplesLabel } from "./SelectedSamplesLabel";

const SelectedSamplesList = styled(BoxGroup)`
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
        <BoxGroupSection key={id} disabled>
            {name}
        </BoxGroupSection>
    ));

    return (
        <React.Fragment>
            <SelectedSamplesLabel count={count} />
            <SelectedSamplesList count={count}>{sampleComponents}</SelectedSamplesList>
        </React.Fragment>
    );
};
