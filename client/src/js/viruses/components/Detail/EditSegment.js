import React from "react";
import PropTypes from "prop-types";
import { Modal } from "react-bootstrap";
import { Button } from "../../../base";
import SegmentForm from "./SegmentForm";
import { findIndex } from "lodash-es";
import { connect } from "react-redux";

const getInitialState = (props) => ({
    newEntry: {
        name: props.curSeg.name,
        molecule: props.curSeg.molecule,
        required: props.curSeg.required,
        showError: false
    }
});

class EditSegment extends React.Component {

    constructor (props) {
        super(props);

        this.state = getInitialState(this.props);
    }

    updateState = () => {
        this.setState(getInitialState(this.props));
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

    handleSubmit = () => {

        if (this.state.newEntry.name) {
            const newArray = this.props.schema.slice();
            const name = this.props.curSeg.name;
            const index = findIndex(newArray, ["name", name]);

            newArray[index] = this.state.newEntry;

            this.props.onSubmit(newArray);
        } else {
            this.setState({showError: true});
        }
    }

    render () {

        return (
            <Modal show={this.props.show} onHide={this.props.onHide} onEnter={this.updateState}>
                <Modal.Header closeButton>
                    Edit Segment Type
                </Modal.Header>
                <Modal.Body>
                    <SegmentForm
                        onChange={this.handleChange}
                        newEntry={this.state.newEntry}
                        show={this.state.showError}
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

EditSegment.propTypes = {
    schema: PropTypes.arrayOf(PropTypes.object),
    show: PropTypes.bool.isRequired,
    onHide: PropTypes.func,
    onSubmit: PropTypes.func,
    curSeg: PropTypes.object.isRequired
};

const mapStateToProps = (state) => ({
    schema: state.viruses.detail.schema
});

export default connect(mapStateToProps)(EditSegment);
