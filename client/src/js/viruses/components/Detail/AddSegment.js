import React from "react";
import PropTypes from "prop-types";
//import { connect } from "react-redux";
import { Modal } from "react-bootstrap";

//import { addIsolate, hideVirusModal } from "../../actions";
import { Button } from "../../../base";
import SegmentForm from "./SegmentForm";


const getInitialState = () => ({
    newEntry: {
        id: 0,
        name: "",
        type: "",
    }
});

export default class AddIsolate extends React.Component {

    constructor (props) {
        super(props);

        this.state = getInitialState();
    }

    handleChange = (entry) => {
        this.setState({
            newEntry: {
                id: this.props.total+1,
                name: entry.name,
                type: entry.type
            }
        });
    }

    handleSubmit = () => {
        this.props.onSubmit(this.state.newEntry);
    }

    handleExited = () => {
        this.setState(getInitialState());
    }

    render () {

        return (
            <Modal show={this.props.show} onExited={this.handleExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Add New Segment Type
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
