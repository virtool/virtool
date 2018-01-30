import React from "react";
import { connect } from "react-redux";

import { removeIsolate, hideVirusModal } from "../../actions";
import { RemoveModal } from "../../../base";

export class RemoveIsolate extends React.Component {

    handleConfirm = () => {
        this.props.onConfirm(this.props.virusId, this.props.isolateId, this.props.nextIsolateId);
    };

    render () {
        return (
            <RemoveModal
                name={this.props.isolateName}
                noun="isolate"
                onConfirm={this.handleConfirm}
                onHide={this.props.onHide}
                show={this.props.show}
            />
        );
    }
}

const mapStateToProps = state => ({
    show: state.viruses.removeIsolate
});

const mapDispatchToProps = dispatch => ({

    onHide: () => {
        dispatch(hideVirusModal());
    },

    onConfirm: (virusId, isolateId, nextIsolateId) => {
        dispatch(removeIsolate(virusId, isolateId, nextIsolateId));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(RemoveIsolate);

export default Container;
