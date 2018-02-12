import React from "react";
// import PropTypes from "prop-types";
import { Modal } from "react-bootstrap";
import { Button } from "../../../base";
import SegmentForm from "./SegmentForm";
import { findIndex } from "lodash-es";
import { connect } from "react-redux";

const getInitialState = (props) => ({
    newEntry: {
        name: props.name,
        molecule: props.molecule,
        required: props.required
    }
});

class EditSegment extends React.Component {

    constructor (props) {
        super(props);

        this.state = getInitialState(this.props);
    }

    handleChange = (entry) => {
        this.setState({
            newEntry: {
                name: entry.name,
                molecule: entry.molecule,
                required: entry.required
            }
        });
    }

    handleSubmit = (e) => {
        e.preventDefault();
        e.stopPropagation();

        console.log(this.props);

        let newArray = this.props.schema.slice();
        let name = this.props.curSeg;
//        const index = findIndex(newArray, function(o) { return o.name === this.props.curSeg; });
        const index = findIndex(newArray, function(o) { return o.name === name; });
//        const index = findIndex(newArray, function(o) { return o.name === "bye"});
//        console.log(`index is = ${index}`);

        console.log(this.props.curSeg);
        console.log(newArray);
        console.log(typeof this.props.curSeg);
        newArray[index] = this.state.newEntry;

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

const mapStateToProps = (state) => {

    return {
        schema: state.viruses.detail.schema,
    };
};

export default connect(mapStateToProps)(EditSegment);
