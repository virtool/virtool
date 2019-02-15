import React from "react";
import { connect } from "react-redux";
import { ListGroupItem } from "../../base";
import { changeActiveGroup } from "../actions";

export const Group = ({ id, active, onSelect }) => (
    <ListGroupItem key={id} active={active} onClick={onSelect}>
        <span className="text-capitalize">{id}</span>
    </ListGroupItem>
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
