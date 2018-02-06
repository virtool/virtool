import React from "react";
import PropTypes from "prop-types";
//import { connect } from "react-redux";
import { Modal } from "react-bootstrap";

//import { addIsolate, hideVirusModal } from "../../actions";
import { Button } from "../../../base";
import SegmentForm from "./SegmentForm";

export default class AddIsolate extends React.Component {

    render () {
        return (
            <Modal show={this.props.show}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Add a New Segment Type
                </Modal.Header>
                <Modal.Body>
                    <SegmentForm
                        ref={(node) => this.formNode = node}
                        onChange={this.handleChange}
                        onSubmit={this.handleSubmit}
                    />
                </Modal.Body>
                <Modal.Footer>
                    <Button bsStyle="primary" icon="floppy" onClick={this.save}>
                        Save
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}
