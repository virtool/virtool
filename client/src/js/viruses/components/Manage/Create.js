/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AddVirus
 */

import React from "react";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { Row, Col, Modal, Alert, ButtonToolbar } from "react-bootstrap";

import { Icon, Flex, FlexItem, Input, Button } from "virtool/js/components/Base";
import { createVirusSetName, createVirusSetAbbreviation, createVirusClear } from "../../actions";

/**
 * A form for adding a new virus, defining its name and abbreviation.
 */
class CreateVirus extends React.Component {

    constructor (props) {
        super(props);
    }

    static propTypes = {
        name: React.PropTypes.string,
        abbreviation: React.PropTypes.string,
        errors: React.PropTypes.arrayOf(React.PropTypes.string),
        onSetName: React.PropTypes.func,
        onSetAbbreviation: React.PropTypes.func,
        onHide: React.PropTypes.func
    };

    componentDidMount () {
        this.inputNode.focus();
    }

    render () {

        let alert;

        if (this.props.errors.length) {
            let message;

            // Show an error when no virus name is defined. Getting this error doesn't require a trip to the server.
            if (this.props.errors.unnamed) {
                message = "A virus name must be provided";
            }

            // Show an error when the provided name or abbreviation is already in use in the database. These errors are
            // sent by the server.
            else {
                if (this.props.errors.name) {
                    message = "Name is already in use";
                }

                if (this.state.error.abbreviation) {
                    message = "Abbreviation is already in use";
                }

                if (this.state.error.name && this.state.error.abbreviation) {
                    message = "Name and abbreviation are already in use";
                }
            }

            // Construct the alert component. The component will be null if no errors are defined.
            alert = (
                <Alert bsStyle="danger">
                    <Flex>
                        <FlexItem grow={0} shrink={0}>
                            <Icon name="warning" />
                        </FlexItem>
                        <FlexItem grow={1} shrink={0} pad>
                            {message}
                        </FlexItem>
                    </Flex>
                </Alert>
            );
        }

        const inputProps = {
            type: "text",
            onChange: this.handleChange
        };

        return (
            <Modal show={true} onHide={this.props.onHide} onExited={this.modalExited} animation={false}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Create Virus
                </Modal.Header>

                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <Row>
                            <Col md={9}>
                                <Input
                                    {...inputProps}
                                    ref={(node) => this.inputNode = node}
                                    label="Name"
                                    value={this.props.name}
                                    onChange={(e) => {this.props.onSetName(e.target.value)}}
                                />
                            </Col>
                            <Col md={3}>
                                <Input
                                    {...inputProps}
                                    label="Abbreviation"
                                    value={this.props.abbreviation}
                                    onChange={(e) => {this.props.onSetAbbreviation(e.target.value)}}
                                />
                            </Col>
                        </Row>

                        {alert}
                    </Modal.Body>

                    <Modal.Footer>
                        <ButtonToolbar className="pull-right">
                            <Button type="submit" bsStyle="primary">
                                <Icon name="floppy"/> Save
                            </Button>
                        </ButtonToolbar>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }

}

const mapStateToProps = (state) => {
    return state.createVirus;
};

const mapDispatchToProps = (dispatch, ownProps) => {
    return {
        onSetName: (name) => {
            dispatch(createVirusSetName(name));
        },

        onSetAbbreviation: (abbreviation) => {
            dispatch(createVirusSetAbbreviation(abbreviation));
        },

        onHide: () => {
            ownProps.history.push("/viruses");
            dispatch(createVirusClear());
        }
    };
};

const CreateVirusContainer = withRouter(connect(
    mapStateToProps,
    mapDispatchToProps
)(CreateVirus));

export default CreateVirusContainer;

