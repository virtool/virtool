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
import { Row, Col, Modal, Alert, ButtonToolbar } from "react-bootstrap";
import { Icon, Flex, FlexItem, Input, Button } from "virtool/js/components/Base";

const getInitialState = () => ({
    name: "",
    abbreviation: "",
    error: null
});

/**
 * A form for adding a new virus, defining its name and abbreviation.
 */
export default class AddVirus extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        show: React.PropTypes.bool.isRequired,
        onHide: React.PropTypes.func.isRequired
    };

    componentDidUpdate (prevProps) {
        // Focus on the first input field ("name") when the modal is shown.
        if (this.props.show && !prevProps.show) {
            this.inputNode.focus();
        }
    }

    modalExited = () => {
        this.setState(getInitialState());
    };

    /**
     * Handles change events in input fields. Updates state based on the name and value of the event target.
     *
     * @param event {object} - the change event.
     */
    handleChange = (event) => {
        let newState = {};
        newState[event.target.name] = event.target.value;
        this.setState(newState);
    };

    /**
     * Submits the form data to the server to add a new virus. Binds callbacks to the success or failure of the request.
     *
     * @param event {object} - The passed event. Used only for preventing the default action.
     */
    handleSubmit = (event) => {
        event.preventDefault();

        // Only send a request to the server if a new virus name is defined.
        if (this.state.name !== "") {
            dispatcher.db.viruses.request("add", {name: this.state.name, abbreviation: this.state.abbreviation})
                .success((virusId) => {
                    this.setState(getInitialState(), () => dispatcher.router.setExtra(["detail", virusId]));
                })
                .failure((data) => {
                    this.setState({error: data});
                });
        }

        // Set state to show an error because no virus name is defined.
        else {
            this.setState({
                error: {
                    name: false,
                    abbreviation: false,
                    unnamed: true
                }
            });
        }
    };

    render () {
        // An alert that can be shown when an error occurs when submitting the form.
        let alert;

        if (this.state.error) {
            let message;

            // Show an error when no virus name is defined. Getting this error doesn"t require a trip to the server.
            if (this.state.error.unnamed) {
                message = "A virus name must be provided";
            }

            // Show an error when the provided name or abbreviation is already in use in the database. These errors are
            // sent by the server.
            else {
                if (this.state.error.name) {
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
            <Modal show={this.props.show} onHide={this.props.onHide} onExited={this.modalExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    New Virus
                </Modal.Header>

                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <Row>
                            <Col md={9}>
                                <Input
                                    {...inputProps}
                                    name="name"
                                    label="Name"
                                    value={this.state.name}
                                    ref={(node) => this.inputNode = node}
                                />
                            </Col>
                            <Col md={3}>
                                <Input
                                    {...inputProps}
                                    name="abbreviation"
                                    label="Abbreviation"
                                    value={this.state.abbreviation}
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
