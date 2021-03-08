import React from "react";
import styled from "styled-components";
import { connect } from "react-redux";
import { BoxGroupSection, Icon } from "../../base";
import { changeActiveGroup } from "../actions";

const StyledGroup = styled(BoxGroupSection)`
    text-transform: capitalize;
    display: flex;
`;

const StyledGroupIcon = styled.div`
    margin-left: auto;
    text-align: right;
`;

export const Group = ({ id, active, onSelect }) => (
    <StyledGroup key={id} active={active} onClick={onSelect}>
        {id}
        <StyledGroupIcon>{active && <Icon color="green" name="check" />}</StyledGroupIcon>
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

export default connect(mapStateToProps, mapDispatchToProps)(Group);
