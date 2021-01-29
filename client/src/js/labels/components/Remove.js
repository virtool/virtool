import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { pushState } from "../../app/actions";
import { getRouterLocationStateValue } from "../../app/selectors";
import { RemoveModal } from "../../base";
import { removeLabel } from "../actions";
import { getLabelById } from "../selectors";

export const RemoveLabel = ({ id, name, show, onHide, onRemove }) => {
    return <RemoveModal noun="Label" name={name} show={show} onConfirm={() => onRemove(id)} onHide={onHide} />;
};

export const mapStateToProps = state => {
    const id = getRouterLocationStateValue(state, "removeLabel");
    const name = get(getLabelById(state, id), "name");

    return {
        id,
        name,
        show: !!id
    };
};

export const mapDispatchToProps = dispatch => ({
    onRemove: id => {
        dispatch(removeLabel(id));
    },

    onHide: () => {
        dispatch(pushState({ removeLabel: false }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(RemoveLabel);
