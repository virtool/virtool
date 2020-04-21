import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { pushState } from "../../app/actions";
import { Button, DialogBody, DialogFooter, ModalDialog } from "../../base";
import { clearError } from "../../errors/actions";
import { routerLocationHasState } from "../../utils/utils";
import { createIndex, getUnbuilt } from "../actions";
import RebuildHistory from "./History";
import { RebuildIndexError } from "./RebuildError";

class RebuildIndex extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: "" };
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

    handleSubmit = e => {
        e.preventDefault();
        this.props.onRebuild(this.props.refId);
    };

    render() {
        const error = this.state.error || this.props.error;

        return (
            <ModalDialog
                label="Rebuild"
                headerText="Rebuild Index"
                size="lg"
                show={this.props.show}
                onHide={this.handleHide}
            >
                <form onSubmit={this.handleSubmit}>
                    <DialogBody>
                        <RebuildIndexError error={error} />
                        <RebuildHistory unbuilt={this.props.unbuilt} error={this.state.error} />
                    </DialogBody>
                    <DialogFooter>
                        <Button type="submit" color="blue" icon="wrench">
                            Start
                        </Button>
                    </DialogFooter>
                </form>
            </ModalDialog>
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
