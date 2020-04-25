import { find, findIndex } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import { connect } from "react-redux";
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from "../../../../base";
import SegmentForm from "./Form";

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

    handleChange = entry => {
        this.setState({
            newEntry: {
                name: entry.name,
                molecule: entry.molecule,
                required: entry.required
            }
        });
    };

    handleModalEnter = () => {
        this.setState(getInitialState(this.props));
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

    render() {
        return (
            <Modal
                label="Edit Segment"
                show={this.props.show}
                onHide={this.props.onHide}
                onEnter={this.handleModalEnter}
            >
                <ModalHeader>Edit Segment</ModalHeader>
                <form onSubmit={this.handleSubmit}>
                    <ModalBody>
                        <SegmentForm onChange={this.handleChange} newEntry={this.state.newEntry} />
                    </ModalBody>
                    <ModalFooter>
                        <Button color="blue" icon="save" type="submit">
                            Save
                        </Button>
                    </ModalFooter>
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
