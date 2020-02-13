import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { find } from "lodash-es";
import { Button, ModalDialog, DialogBody, DialogFooter } from "../../../base";
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

    handleExited = () => {
        this.setState(getInitialState());
    };

    render() {
        return (
            <ModalDialog
                headerText="Add Segment"
                label="AddSegment"
                show={this.props.show}
                onExited={this.handleExited}
                onHide={this.props.onHide}
            >
                <form onSubmit={this.handleSubmit}>
                    <DialogBody>
                        <SegmentForm onChange={this.handleChange} newEntry={this.state.newEntry} />
                    </DialogBody>
                    <DialogFooter>
                        <Button bsStyle="primary" type="submit">
                            Save
                        </Button>
                    </DialogFooter>
                </form>
            </ModalDialog>
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
