import { keys, map, reject } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import styled from "styled-components";
import { Label, LinkBox } from "../../base";

const StyledHMMItem = styled(LinkBox)`
    display: flex;
`;

const HMMItemCluster = styled.strong`
    flex: 0 0 48px;
`;

const HMMItemName = styled.span`
    flex: 1 0 auto;
`;

const HMMItemFamilies = styled.div`
    align-items: center;
    display: flex;
    margin-left: auto;
`;

export default function HMMItem({ cluster, families, id, names }) {
    const filteredFamilies = reject(keys(families), family => family === "None");

    const labelComponents = map(filteredFamilies.slice(0, 3), (family, i) => (
        <Label key={i} spaced>
            {family}
        </Label>
    ));

    return (
        <StyledHMMItem to={`/hmm/${id}`}>
            <HMMItemCluster>{cluster}</HMMItemCluster>
            <HMMItemName>{names[0]}</HMMItemName>
            <HMMItemFamilies>
                {labelComponents} {filteredFamilies.length > 3 ? "..." : null}
            </HMMItemFamilies>
        </StyledHMMItem>
    );
}

HMMItem.propTypes = {
    cluster: PropTypes.number,
    families: PropTypes.object,
    id: PropTypes.string,
    names: PropTypes.array
};
