import React from "react";
import { connect } from "react-redux";
import { get } from "lodash-es";
import { pushState } from "../../app/actions";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../../base";
import { labelEdit } from "../actions";
const getInitialState = ({}) => ({
    error: ""
});

class LabelEdit extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    handleModalEnter = () => {
        this.setState(getInitialState(this.props));
    };

    handleModalExited = () => {
        if (this.props.error) {
            this.props.onClearError();
        }
    };

    render() {
        return (
            <Modal
                label="Label Editor"
                show={this.props.show}
                onEnter={this.handleModalEnter}
                onExited={this.handleModalExited}
                onHide={this.props.onHide}
            >
                <ModalHeader>Label Editor</ModalHeader>
                <form>
                    <ModalBody></ModalBody>
                    <ModalFooter></ModalFooter>
                </form>
            </Modal>
        );
    }
}

const mapStateToProps = state => ({
    ...state.samples.detail,
    show: get(state.router.location.state, "labelEdit", false),
    error: get(state, "errors.UPDATE_SAMPLE_ERROR.message", "")
});

const mapDispatchToProps = dispatch => ({
    onHide: () => {
        dispatch(pushState({ showEdit: false }));
    },

    onEdit: (sampleId, update) => {
        dispatch(labelEdit(sampleId, update));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(LabelEdit);
