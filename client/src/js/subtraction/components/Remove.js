import React from "react";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { removeSubtraction } from "../actions";
import { RemoveModal } from "../../base";
import { routerLocationHasState } from "../../utils/utils";

export class RemoveSubtraction extends React.Component {
    handleConfirm = () => {
        this.props.onConfirm(this.props.id);
    };

    render() {
        const { id, onHide, show } = this.props;

        return (
            <RemoveModal
                id={id}
                name={id}
                noun="Subtraction"
                show={show}
                onHide={onHide}
                onConfirm={this.handleConfirm}
            />
        );
    }
}

const mapStateToProps = state => ({
    show: routerLocationHasState(state, "removeSubtraction", true)
});

const mapDispatchToProps = dispatch => ({
    onHide: () => {
        dispatch(push({ state: { removeSubtraction: false } }));
    },

    onConfirm: subtractionId => {
        dispatch(removeSubtraction(subtractionId));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(RemoveSubtraction);
