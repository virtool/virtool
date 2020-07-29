import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { getFontSize, getFontWeight } from "../../app/theme";
import { Icon, LinkBox, Loader } from "../../base";

export const SubtractionItemIcon = ({ ready }) => {
    if (ready) {
        return <Icon name="check" color="green" />;
    }

    return <Loader size="14px" color="#3c8786" />;
};

const StyledSubtractionItem = styled(LinkBox)`
    align-items: center;
    display: flex;
    font-size: ${getFontSize("lg")};
    font-weight: ${getFontWeight("thick")};

    > span:last-child {
        margin-left: auto;
    }
`;

export const SubtractionItem = ({ id, name, ready }) => (
    <StyledSubtractionItem key={id} to={`/subtraction/${id}`}>
        <strong>{name}</strong>
        <span>
            <SubtractionItemIcon ready={ready} /> <span>{ready ? "Ready" : "Importing"}</span>
        </span>
    </StyledSubtractionItem>
);

export const mapStateToProps = (state, props) => {
    const { id, name, ready } = state.subtraction.documents[props.index];
    return {
        id,
        name,
        ready
    };
};

export default connect(mapStateToProps)(SubtractionItem);
