import React from "react";
import PropTypes from "prop-types";
import { LinkContainer } from "react-router-bootstrap";
import { keys, map, reject } from "lodash-es";
import styled from "styled-components";
import { device, Label, SpacedBox } from "../../base";

const StyledChange = styled(SpacedBox)`
    display: flex;
    justify-content: space-between;
`;

const NameTag = styled.div`
    display: flex;
    justify-content: space-between;
    width: 83%;

    @media (max-width: ${device.tabelet}) {
        flex-flow: row wrap;
        flex-direction: column;
        width: 95%;
    }
`;

const Name = styled.div`
    display: flex;
    @media (max-width: ${device.tabelet}) {
        justify-content: flex-start;
    }
`;

const Tag = styled.div`
    display: flex;
    @media (max-width: ${device.tabelet}) {
        justify-content: flex-start;
    }
`;

export default function HMMItem({ cluster, families, id, names }) {
    const filteredFamilies = reject(keys(families), family => family === "None");

    const labelComponents = map(filteredFamilies.slice(0, 3), (family, i) => (
        <Label key={i} spaced>
            {family}
        </Label>
    ));

    return (
        <LinkContainer to={`/hmm/${id}`}>
            <StyledChange className="spaced">
                <span>
                    <strong>{cluster}</strong>
                </span>
                <NameTag>
                    <Name>{names[0]}</Name>
                    <Tag>
                        {labelComponents} {filteredFamilies.length > 3 ? "..." : null}
                    </Tag>
                </NameTag>
            </StyledChange>
        </LinkContainer>
    );
}

HMMItem.propTypes = {
    cluster: PropTypes.number,
    families: PropTypes.object,
    id: PropTypes.string,
    names: PropTypes.array
};
