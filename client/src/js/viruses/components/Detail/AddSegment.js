import React from "react";
import PropTypes from "prop-types";
import { Modal } from "react-bootstrap";
import { connect } from "react-redux";
import { Button } from "../../../base";
import SegmentForm from "./SegmentForm";

const getInitialState = () => ({
    newEntry: {
        name: "",
        molecule: null,
        required: false
    },
    showError: false
});

class AddSegment extends React.Component {

    constructor (props) {
        super(props);

        this.state = getInitialState();
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
            this.props.onSubmit([...this.props.schema, this.state.newEntry]);
        } else {
            this.setState({showError: true});
        }
    }

    handleExited = () => {

        this.setState(getInitialState());
    }

    render () {

        return (
            <Modal show={this.props.show} onExited={this.handleExited} onHide={this.props.onHide}>
                <Modal.Header closeButton>
                    Add Segment
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

AddSegment.propTypes = {
    schema: PropTypes.arrayOf(PropTypes.object),
    show: PropTypes.bool.isRequired,
    onHide: PropTypes.func,
    onSubmit: PropTypes.func
};

const mapStateToProps = (state) => ({
    schema: state.viruses.detail.schema
});

export default connect(mapStateToProps)(AddSegment);
