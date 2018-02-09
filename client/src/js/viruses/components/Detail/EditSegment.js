import React from "react";
// import PropTypes from "prop-types";
import { Modal } from "react-bootstrap";
import { Button } from "../../../base";
import SegmentForm from "./SegmentForm";
import { concat } from "lodash-es";

const getInitialState = (props) => ({
    newEntry: {
        name: props.name,
        molecule: props.molecule,
        required: props.required
    }
});

export default class EditSegment extends React.Component {

    constructor (props) {
        super(props);

        this.state = getInitialState(this.props);
    }

    handleChange = (entry) => {
        this.setState({
            modEntry: {
                name: entry.name,
                molecule: entry.molecule,
                required: entry.required
            }
        });
    }

    handleSubmit = (e) => {
        e.preventDefault();
        e.stopPropagation();

        let newArray = this.props.curSegArr.slice();
//        newArray = concat(newArray, this.state.newEntry);

        this.props.onSubmit(newArray);
    }

    handleExited = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        this.setState(getInitialState());
    }

    render () {

        return (
            <Modal show={this.props.show} onExited={this.handleExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Edit Segment Type
                </Modal.Header>
                <Modal.Body>
                    <SegmentForm
                        ref={(node) => this.formNode = node}
                        onChange={this.handleChange}
                        newEntry={this.state.newEntry}
                    />
                </Modal.Body>
                <Modal.Footer>
                    <Button bsStyle="primary" icon="floppy" onClick={this.handleSubmit} >
                        Save
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}
