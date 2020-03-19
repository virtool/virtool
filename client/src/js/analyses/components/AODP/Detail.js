import { map } from "lodash-es";
import React from "react";
import styled from "styled-components";

import { connect } from "react-redux";
import { BoxGroup, BoxGroupHeader, BoxGroupSection } from "../../../base";
import { formatIsolateName } from "../../../utils/utils";
import { getActiveHit } from "../../selectors";
import IsolateItem from "./IsolateItem";

const StyledIsolateItem = styled(IsolateItem)`
    margin-top: 17px;
`;

export const AODPDetail = ({ result }) => {
    let isolateComponents;
    let overallIdentities;
    let resultHeader = <BoxGroupSection>No Hits</BoxGroupSection>;

    if (result) {
        overallIdentities = result.identities.length;

        const { isolates } = result;
        isolateComponents = map(isolates, isolate => (
            <BoxGroupSection key={isolate.id} isolate={isolate}>
                <div>{formatIsolateName(isolate)}</div>
                <strong> {isolate.identities.length} hits</strong>
                <StyledIsolateItem {...isolate} />
            </BoxGroupSection>
        ));

        resultHeader = (
            <BoxGroupSection>
                <div>Overall</div>
                <strong>{overallIdentities} hits</strong>
            </BoxGroupSection>
        );
    }

    return (
        <BoxGroup>
            <BoxGroupHeader>
                <h2>{result.name}</h2>
            </BoxGroupHeader>
            {resultHeader}

            {isolateComponents}
        </BoxGroup>
    );
};

const mapStateToProps = state => {
    const hit = getActiveHit(state);
    return {
        result: hit
    };
};

export default connect(mapStateToProps)(AODPDetail);
