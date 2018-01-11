import React from "react";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { Modal } from "react-bootstrap";

import { getUnbuilt, createIndex } from "../actions";
import { Button, LoadingPlaceholder } from "../../base";
import RebuildHistory from "./History";
import {routerLocationHasState} from "../../utils";

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
    show: routerLocationHasState(state, "rebuild", true),
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
        dispatch(push({...window.location, state: {rebuild: false}}));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(RebuildIndex);

export default Container;
