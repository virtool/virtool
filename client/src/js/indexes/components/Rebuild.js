import React from "react";
import { connect } from "react-redux";
import { Modal } from "react-bootstrap";

import { getUnbuilt, createIndex, hideRebuild } from "../actions";
import { Button, LoadingPlaceholder } from "../../base";
import RebuildHistory from "./History";

class RebuildIndex extends React.Component {

    modalEntered = () => {
        this.props.onGetUnbuilt();
    };

    save = (e) => {
        e.preventDefault();
        this.props.onRebuild();
    };

    render () {
        let history;

        if (this.props.unbuilt) {
            history = <RebuildHistory unbuilt={this.props.unbuilt} />;
        } else {
            history = <LoadingPlaceholder margin="70px" />;
        }

        return (
            <Modal bsSize="large" onEntered={this.modalEntered} show={this.props.show} onHide={this.props.onHide}>
                <Modal.Header>
                    Rebuild Index
                </Modal.Header>
                <form onSubmit={this.save}>
                    <Modal.Body>
                        {history}
                    </Modal.Body>
                    <Modal.Footer>
                        <Button type="submit" bsStyle="primary" icon="hammer">
                            Start
                        </Button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

const mapStateToProps = (state) => ({
    show: !!state.indexes.showRebuild,
    unbuilt: state.indexes.unbuilt
});

const mapDispatchToProps = (dispatch) => ({

    onGetUnbuilt: () => {
        dispatch(getUnbuilt());
    },

    onRebuild: () => {
        dispatch(createIndex());
    },

    onHide: () => {
        dispatch(hideRebuild());
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(RebuildIndex);

export default Container;
