import React from "react";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { Modal } from "react-bootstrap";

import { getUnbuilt, createIndex } from "../actions";
import { Button, LoadingPlaceholder } from "../../base";
import RebuildHistory from "./History";
import {routerLocationHasState} from "../../utils";

class RebuildIndex extends React.Component {

    constructor (props) {
        super(props);

        this.state = { error: "" };
    }

    componentWillReceiveProps (nextProps) {
        if (nextProps.errors && nextProps.errors.CREATE_INDEX_ERROR) {
            this.setState({ error: nextProps.errors.CREATE_INDEX_ERROR.message });
        }
    }

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
            history = <RebuildHistory unbuilt={this.props.unbuilt} error={this.state.error} />;
        } else {
            history = <LoadingPlaceholder margin="70px" />;
        }

        const errorDisplay = this.state.error
            ? (
                <div className="input-form-error">
                    <span className="input-error-message">{this.state.error}</span>
                    <br />
                    <span className="input-error-message">
                        Please modify the unverified viruses before rebuilding the index
                    </span>
                </div>
            )
            : null;

        return (
            <Modal bsSize="large" onEntered={this.modalEntered} show={this.props.show} onHide={this.props.onHide}>
                <Modal.Header>
                    Rebuild Index
                </Modal.Header>
                <form onSubmit={this.save}>
                    <Modal.Body>
                        {history}
                        {errorDisplay}
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
    unbuilt: state.indexes.unbuilt,
    errors: state.errors
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
