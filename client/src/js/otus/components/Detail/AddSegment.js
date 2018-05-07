import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Modal } from "react-bootstrap";
import { find } from "lodash-es";
import SegmentForm from "./SegmentForm";
import { Button } from "../../../base";

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

        const checkName = find(this.props.schema, ["name", this.state.newEntry.name]);

        if (checkName) {
            this.setState({newEntry: {...this.state.newEntry, nameTaken: true}});
        } else if (this.state.newEntry.name) {
            this.setState({newEntry: {...this.state.newEntry, nameTaken: false}});
            this.props.onSubmit([...this.props.schema, this.state.newEntry]);
        } else {
            this.setState({newEntry: {...this.state.newEntry, showError: true, nameTaken: false}});
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
    schema: state.OTUs.detail.schema
});

export default connect(mapStateToProps)(AddSegment);
