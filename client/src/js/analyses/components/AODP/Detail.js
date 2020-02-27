import { map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { BoxGroup, BoxGroupHeader, BoxGroupSection } from "../../../base";
import { formatIsolateName } from "../../../utils/utils";
import { getActiveHit } from "../../selectors";

export const AODPDetail = ({ hit }) => {
    const { name, isolates } = hit;

    const isolateComponents = map(isolates, isolate => <p key={isolate.id}>{formatIsolateName(isolate)}</p>);

    return (
        <BoxGroup>
            <BoxGroupHeader>
                <h2>{name}</h2>
            </BoxGroupHeader>
            <BoxGroupSection>{isolateComponents}</BoxGroupSection>
        </BoxGroup>
    );
};

const mapStateToProps = state => ({
    hit: getActiveHit(state)
});

export default connect(mapStateToProps)(AODPDetail);
