import React from "react";
import styled from "styled-components";
import { connect } from "react-redux";
import { SpacedBox } from "../../base";

const NameDescription = styled(SpacedBox)`
    display: grid;
    grid-template-columns: 1fr 1fr;
`;

export const IndexChange = ({ description, otuName }) => (
    <NameDescription>
        <strong>{otuName}</strong>
        {description}
    </NameDescription>
);

export const mapStateToProps = (state, ownProps) => {
    const { otu, description } = state.indexes.history.documents[ownProps.index];
    return {
        description,
        otuName: otu.name
    };
};

export default connect(mapStateToProps)(IndexChange);
