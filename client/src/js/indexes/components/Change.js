import React from "react";
import styled from "styled-components";
import { connect } from "react-redux";
import { SpacedBox } from "../../base";

const StyledIndexChange = styled(SpacedBox)`
    display: grid;
    grid-template-columns: 1fr 1fr;
`;

export const IndexChange = ({ description, otuName }) => (
    <StyledIndexChange>
        <strong>{otuName}</strong>
        {description}
    </StyledIndexChange>
);

export const mapStateToProps = (state, ownProps) => {
    const { otu, description } = state.indexes.history.documents[ownProps.index];
    return {
        description,
        otuName: otu.name
    };
};

export default connect(mapStateToProps)(IndexChange);
