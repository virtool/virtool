import React from "react";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { Modal, ButtonToolbar } from "react-bootstrap";
import { upperFirst } from "lodash-es";
import ReferenceForm from "../Form";
import { editReference } from "../../actions";
import { clearError } from "../../../errors/actions";
import { Button } from "../../../base";
import { routerLocationHasState } from "../../../utils";

const getInitialState = (detail) => ({
    name: detail.name,
    description: detail.description,
    dataType: detail.data_type,
    organism: detail.organism,
    isPublic: detail.public,
    internalControl: "",
    errorName: "",
    errorDataType: ""
});

export class EditReference extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(this.props.detail);
    }

    handleChange = (e) => {
        const { name, value } = e.target;

        if (name !== "name" && name !== "dataType") {
            return this.setState({ [name]: value });
        }

        const errorType = `error${upperFirst(e.target.name)}`;

        this.setState({
            [name]: value,
            [errorType]: ""
        });
    };

    handleHide = () => {
        this.props.onHide(this.props);
    };

    handleModalExited = () => {
        this.setState(getInitialState(this.props.detail));
    };

    handleSubmit = (e) => {
        e.preventDefault();

        if (!this.state.name.length) {
            this.setState({ errorName: "Required Field" });
        }

        if (!this.state.dataType.length) {
            this.setState({ errorDataType: "Required Field" });
        }

        if (this.state.name.length && this.state.dataType.length) {
            this.props.onSubmit(
                this.props.detail.id,
                {
                    name: this.state.name,
                    description: this.state.description,
                    data_type: this.state.dataType,
                    organism: this.state.organism,
                    public: this.state.isPublic,
                    internal_control: this.state.internalControl
                }
            );
            this.props.onHide(window.location);
        }

    };

    toggleCheck = () => {
        this.setState({ isPublic: !this.state.isPublic });
    };

    render () {

        return (
            <Modal show={this.props.show} onHide={this.handleHide} onExited={this.handleModalExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Edit Reference
                </Modal.Header>
                <Modal.Body>
                    <ReferenceForm state={this.state} onChange={this.handleChange} toggle={this.toggleCheck} />
                </Modal.Body>

                <Modal.Footer>
                    <ButtonToolbar className="pull-right">
                        <Button icon="save" type="submit" bsStyle="primary" onClick={this.handleSubmit}>
                            Save
                        </Button>
                    </ButtonToolbar>
                </Modal.Footer>
            </Modal>
        );
    }
}

const mapStateToProps = state => ({
    show: routerLocationHasState(state, "editReference"),
    detail: state.references.detail
});

const mapDispatchToProps = dispatch => ({

    onSubmit: (refId, update) => {
        dispatch(editReference(refId, update));
    },

    onHide: ({ location }) => {
        dispatch(push({...location, state: {editReference: false}}));
    },

    onClearError: (error) => {
        dispatch(clearError(error));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(EditReference);
