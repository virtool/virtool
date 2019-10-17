import React from "react";
import styled from "styled-components";
import { connect } from "react-redux";
import { BoxGroupSection } from "../../base";
import { changeActiveGroup } from "../actions";

const StyledGroup = styled(BoxGroupSection)`
    text-transform: capitalize;
`;

export const Group = ({ id, active, onSelect }) => (
    <StyledGroup key={id} active={active} onClick={onSelect}>
        {id}
    </StyledGroup>
);

export const mapStateToProps = (state, ownProps) => ({
    active: state.groups.activeId === ownProps.id
});

export const mapDispatchToProps = (dispatch, ownProps) => ({
    onSelect: () => {
        dispatch(changeActiveGroup(ownProps.id));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(Group);
