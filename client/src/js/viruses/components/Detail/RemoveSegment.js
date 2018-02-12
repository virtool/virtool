import React from "react";
// import PropTypes from "prop-types";
import { Modal } from "react-bootstrap";
import { Button } from "../../../base";
import SegmentForm from "./SegmentForm";
import { filter } from "lodash-es";

export default class RemoveSegment extends React.Component {

    handleSubmit = (e) => {
        e.preventDefault();
        e.stopPropagation();

        let newArray = this.props.curSegArr.slice();
        newArray = filter(newArray, (o) => o.name !== this.props.curSeg.name);

        this.props.onSubmit(newArray);
    }

    render () {
        return (
            <Modal show={this.props.show} onExited={this.handleExited} dialogClassName="modal-danger">
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Remove Segment
                </Modal.Header>
                <Modal.Body>
                    Are you sure you want to remove the segment <strong>{this.props.selected}</strong>?
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        bsStyle="danger"
                        icon="checkmark"
                        onClick={this.handleSubmit}
                    >
                        Confirm
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}
