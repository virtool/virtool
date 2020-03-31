import { filter, map, max, mean, min } from "lodash-es";
import React from "react";
import styled from "styled-components";

import { connect } from "react-redux";
import { Badge, BoxGroup, BoxGroupHeader, BoxGroupSection, Icon } from "../../../base";
import { getActiveHit } from "../../selectors";
import { AODPIsolate } from "./Isolate";

const AODPDetailIdentity = styled.div`
    align-items: center;
    display: flex;

    > div:first-child {
        color: ${props => props.theme.color.blue};
        font-size: 36px;
    }

    > div:last-child {
        display: flex;
        flex-direction: column;
        font-size: 12px;
        font-weight: bold;
        justify-content: center;
        margin-left: 5px;

        span:first-child {
            color: ${props => props.theme.color.greenDark};
        }

        span:last-child {
            color: ${props => props.theme.color.redDark};
        }
    }
`;

const AODPDetailOverview = ({ identities }) => {
    return (
        <BoxGroupSection>
            <AODPDetailIdentity>
                <div>{max(identities)}</div>
                <div>
                    <span>~ {mean(identities).toFixed(2)}</span>
                    <span>
                        <Icon name="arrow-down" /> {min(identities)}
                    </span>
                </div>
            </AODPDetailIdentity>
            <div>IDENTITY</div>
        </BoxGroupSection>
    );
};

export const AODPDetail = ({ hit }) => {
    if (hit === null) {
        return <BoxGroup>None found</BoxGroup>;
    }

    const { name, identities, isolates } = hit;

    const filteredIsolates = filter(isolates, isolate => isolate.identities.length);

    const isolateComponents = map(filteredIsolates, isolate => <AODPIsolate key={isolate.id} {...isolate} />);

    return (
        <BoxGroup>
            <BoxGroupHeader>
                <h2>
                    {name} <Badge>{identities.length} hits</Badge>
                </h2>
            </BoxGroupHeader>
            <AODPDetailOverview identities={identities} />
            {isolateComponents}
        </BoxGroup>
    );
};

const mapStateToProps = state => ({
    hit: getActiveHit(state)
});

export default connect(mapStateToProps)(AODPDetail);
