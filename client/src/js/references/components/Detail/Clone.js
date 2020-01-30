import React from "react";
import PropTypes from "prop-types";
import { BoxGroup, BoxGroupHeader, BoxGroupSection } from "../../../base";

export const Clone = ({ source }) => (
    <BoxGroup>
        <BoxGroupHeader>
            <h2>Clone Reference</h2>
        </BoxGroupHeader>

        <BoxGroupSection>
            <strong>Source Reference</strong>
            <span>
                {" / "}
                <a href={`/refs/${source.id}`}>{source.name}</a>
            </span>
        </BoxGroupSection>
    </BoxGroup>
);

Clone.propTypes = {
    source: PropTypes.object
};
