import { get } from "lodash-es";
import React from "react";
import { Modal } from "react-bootstrap";
import { connect } from "react-redux";
import { pushState } from "../../app/actions";
import { Button } from "../../base";
import { clearError } from "../../errors/actions";
import { routerLocationHasState } from "../../utils/utils";
import { createIndex, getUnbuilt } from "../actions";
import RebuildHistory from "./History";

export const RebuildIndexError = ({ error }) => {
    if (error) {
        return (
            <div className="input-form-error">
                <span className="input-error-message">{error}</span>
                <br />
                {error === "There are unverified OTUs" ? (
                    <span className="input-error-message">Fix the unverified OTUs before rebuilding the index</span>
                ) : null}
            </div>
        );
    }

    return null;
};

class RebuildIndex extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: "" };
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        if (!prevState.error && nextProps.error) {
            return { error: nextProps.error };
        }
        return null;
    }

    componentDidMount() {
        this.props.onGetUnbuilt(this.props.refId);
    }

    handleHide = () => {
        this.setState({ error: "" });

        this.props.onHide();

        if (this.props.error) {
            this.props.onClearError();
        }
    };

    save = e => {
        e.preventDefault();
        this.props.onRebuild(this.props.refId);
    };

    render() {
        return (
            <Modal bsSize="large" show={this.props.show} onHide={this.handleHide}>
                <Modal.Header onHide={this.handleHide} closeButton>
                    Rebuild Index
                </Modal.Header>
                <form onSubmit={this.save}>
                    <Modal.Body>
                        <RebuildHistory unbuilt={this.props.unbuilt} error={this.state.error} />
                        <RebuildIndexError error={this.state.error} />
                    </Modal.Body>
                    <Modal.Footer>
                        <Button type="submit" bsStyle="primary" icon="wrench">
                            Start
                        </Button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

const mapStateToProps = state => ({
    show: routerLocationHasState(state, "rebuild", true),
    unbuilt: state.indexes.unbuilt,
    error: get(state, "errors.CREATE_INDEX_ERROR.message", ""),
    refId: state.references.detail.id
});

const mapDispatchToProps = dispatch => ({
    onGetUnbuilt: refId => {
        dispatch(getUnbuilt(refId));
    },

    onRebuild: refId => {
        dispatch(createIndex(refId));
    },

    onHide: () => {
        dispatch(pushState({ rebuild: false }));
    },

    onClearError: () => {
        dispatch(clearError("CREATE_INDEX_ERROR"));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(RebuildIndex);
