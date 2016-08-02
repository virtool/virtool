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

'use strict';

var React = require('react');
var LinkedStateMixin = require('react-addons-linked-state-mixin');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Modal = require('react-bootstrap/lib/Modal');
var Input = require('react-bootstrap/lib/Input');
var Alert = require('react-bootstrap/lib/Alert');
var Button = require('react-bootstrap/lib/Button');
var ButtonToolbar = require('react-bootstrap/lib/ButtonToolbar');

var Icon = require('virtool/js/components/Base/Icon.jsx');

/**
 * A form for adding a new virus, defining its name and abbreviation.
 */
var AddVirus = React.createClass({

    mixins: [LinkedStateMixin],

    propTypes: {
        show: React.PropTypes.bool.isRequired,
        onHide: React.PropTypes.func.isRequired
    },

    getInitialState: function () {
        return {
            name: '',
            abbreviation: '',
            error: null
        }
    },

    componentDidUpdate: function (prevProps) {
        // Focus on the first input field ('name') when the modal is shown.
        if (this.props.show && !prevProps.show) {
            this.refs.name.getInputDOMNode().focus();
        }
    },

    /**
     * Handles change events in input fields. Updates state based on the name and value of the event target.
     *
     * @param event {object} - the change event.
     */
    handleChange: function (event) {
        var newState = {};
        newState[event.target.name] = event.target.value;
        this.setState(newState);
    },

    /**
     * Submits the form data to the server to add a new virus. Binds callbacks to the success or failure of the request.
     *
     * @param event {object} - The passed event. Used only for preventing the default action.
     */
    handleSubmit: function (event) {
        event.preventDefault();

        // Only send a request to the server if a new virus name is defined.
        if (this.state.name !== '') {
            dispatcher.db.viruses.request('add', {name: this.state.name, abbreviation: this.state.abbreviation})
                .success(function () {
                    this.replaceState(this.getInitialState());
                    this.props.onHide();
                }, this)
                .failure(function () {
                    this.setState({error: data});
                }, this);
        }

        // Set state to show an error because no virus name is defined.
        else {
            this.setState({error: {name: false, abbreviation: false, unnamed: true}});
        }
    },

    render: function () {
        // An alert that can be shown when an error occurs when submitting the form.
        var alert;

        if (this.state.error) {
            var message;

            // Show an error when no virus name is defined. Getting this error doesn't require a trip to the server.
            if (this.state.error.unnamed) {
                message = 'A virus name must be provided';
            }

            // Show an error when the provided name or abbreviation is already in use in the database. These errors are
            // sent by the server.
            else {
                if (this.state.error.name) message = 'Name is already in use';
                if (this.state.error.abbreviation) message = 'Abbreviation is already in use';
                if (this.state.error.name && this.state.error.abbreviation) message = 'Name and abbreviation already in use';
            }

            // Construct the alert component. The component will be null if no errors are defined.
            alert = (
                <Alert bsStyle='danger'>
                    {message}
                </Alert>
            );
        }

        var modalProps = _.extend(this.props, {onHide: this.hide});

        var inputProps = {
            type: 'text',
            onChange: this.handleChange
        };

        return (
            <Modal {...modalProps}>

                <Modal.Header {...modalProps} closeButton>
                    New Virus
                </Modal.Header>

                <form onSubmit={this.handleSubmit}>

                    <Modal.Body {...modalProps}>
                        <Row>
                            <Col md={9}>
                                <Input
                                    {...inputProps}
                                    name='name'
                                    label='Name'
                                    value={this.state.name}
                                    ref='name'
                                />
                            </Col>
                            <Col md={3}>
                                <Input
                                    {...inputProps}
                                    name='abbreviation'
                                    label='Abbreviation'
                                    value={this.state.abbreviation}
                                />
                            </Col>
                        </Row>
                        {alert}
                    </Modal.Body>

                    <Modal.Footer {...modalProps}>
                        <ButtonToolbar className='pull-right'>
                            <Button type='submit' bsStyle='primary'>
                                <Icon name='floppy'/> Save
                            </Button>
                        </ButtonToolbar>
                    </Modal.Footer>

                </form>

            </Modal>
        );
    }

});

module.exports = AddVirus;