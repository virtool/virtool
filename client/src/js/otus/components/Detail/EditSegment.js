import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Modal } from "react-bootstrap";
import { findIndex, find } from "lodash-es";
import { Button } from "../../../base";
import SegmentForm from "./SegmentForm";

const getInitialState = props => ({
    newEntry: {
        name: props.curSeg.name,
        molecule: props.curSeg.molecule,
        required: props.curSeg.required,
        showError: false,
        nameTaken: false
    }
});

class EditSegment extends React.Component {
    constructor(props) {
        super(props);

        this.state = getInitialState(this.props);
    }

    updateState = () => {
        this.setState(getInitialState(this.props));
    };

    handleChange = entry => {
        this.setState({
            newEntry: {
                name: entry.name,
                molecule: entry.molecule,
                required: entry.required
            }
        });
    };

    handleSubmit = e => {
        e.preventDefault();

        const takenName = find(this.props.schema, ["name", this.state.newEntry.name]);

        if (takenName && takenName.name !== this.props.curSeg.name) {
            this.setState({
                newEntry: { ...this.state.newEntry, showError: false, nameTaken: true }
            });
        } else if (this.state.newEntry.name) {
            const newArray = this.props.schema.slice();
            const name = this.props.curSeg.name;
            const index = findIndex(newArray, ["name", name]);

            newArray[index] = this.state.newEntry;

            this.setState({
                newEntry: { ...this.state.newEntry, showError: false, nameTaken: false }
            });

            this.props.onSubmit(newArray);
        } else {
            this.setState({
                newEntry: { ...this.state.newEntry, showError: true, nameTaken: false }
            });
        }
    };

    handleExited = () => {
        this.setState({ showError: false, nameTaken: false });
    };

    render() {
        return (
            <Modal
                show={this.props.show}
                onExited={this.handleExited}
                onHide={this.props.onHide}
                onEnter={this.updateState}
            >
                <Modal.Header closeButton>Edit Segment</Modal.Header>
                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <SegmentForm onChange={this.handleChange} newEntry={this.state.newEntry} />
                    </Modal.Body>
                    <Modal.Footer>
                        <Button bsStyle="primary" icon="save" type="submit">
                            Save
                        </Button>
                    </Modal.Footer>
                </form>
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

const mapStateToProps = state => ({
    schema: state.otus.detail.schema
});

export default connect(mapStateToProps)(EditSegment);
