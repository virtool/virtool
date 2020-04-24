import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { find } from "lodash-es";
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from "../../../base";
import SegmentForm from "./SegmentForm";

const getInitialState = () => ({
    newEntry: {
        name: "",
        molecule: "",
        required: true,
        showError: false,
        nameTaken: false
    }
});

class AddSegment extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState();
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

    handleSubmit = e => {
        e.preventDefault();

        const checkName = find(this.props.schema, ["name", this.state.newEntry.name]);

        if (checkName) {
            this.setState({ newEntry: { ...this.state.newEntry, nameTaken: true } });
        } else if (this.state.newEntry.name) {
            this.setState({ newEntry: { ...this.state.newEntry, nameTaken: false } });
            this.props.onSubmit([...this.props.schema, this.state.newEntry]);
        } else {
            this.setState({
                newEntry: { ...this.state.newEntry, showError: true, nameTaken: false }
            });
        }
    };

    handleModalExited = () => {
        this.setState(getInitialState());
    };

    render() {
        return (
            <Modal
                label="Add Segment"
                show={this.props.show}
                onExited={this.handleModalExited}
                onHide={this.props.onHide}
            >
                <ModalHeader>Add Segment</ModalHeader>
                <form onSubmit={this.handleSubmit}>
                    <ModalBody>
                        <SegmentForm onChange={this.handleChange} newEntry={this.state.newEntry} />
                    </ModalBody>
                    <ModalFooter>
                        <Button color="blue" type="submit">
                            Save
                        </Button>
                    </ModalFooter>
                </form>
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

const mapStateToProps = state => ({
    schema: state.otus.detail.schema ? state.otus.detail.schema : []
});

export default connect(mapStateToProps)(AddSegment);
