/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ConfirmFooter
 */

'use strict';

var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Modal = require('react-bootstrap/lib/Modal');
var ButtonToolbar = require('react-bootstrap/lib/ButtonToolbar');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

/**
 * A special Modal.Footer component that contains an action button customized by the user, and a cancel button. When the
 * action button is clicked, the user is prompted to confirm they are sure of their action.
 */
var ConfirmFooter = React.createClass({

    propTypes: {
        // Function to call if the modal is hiding.
        onHide: React.PropTypes.func.isRequired,

        // Content to place in the action button.
        buttonContent: React.PropTypes.element,

        // String to pass in for bsStyle on the button.
        style: React.PropTypes.string,

        // Function to call when the user confirms they are sure of their action.
        callback: React.PropTypes.func,

        // Warning message to display. By default it is 'Are you sure?'.
        message: React.PropTypes.string,

        // Close the modal when the confirm button is clicked.
        closeOnConfirm: React.PropTypes.bool
    },

    getDefaultProps: function () {
        return {
            buttonContent: <span><Icon name='checkmark-circle'/> Submit</span>,
            style: 'danger',
            callback: function () {console.warn('Action was confirmed. No callback supplied in props.')},
            message: 'Are you sure?',
            closeOnConfirm: true
        };
    },

    getInitialState: function () {
        return {confirming: false};
    },

    /**
     * Switch the footer to confirm mode. The footer gains a red background, confirmation message, and altered buttons.
     */
    showConfirm: function () {
        this.setState({confirming: true});
    },

    /**
     * Function that is called when the confirm button is clicked. Calls the callback function prop, then
     */
    confirm: function () {
        this.props.callback();
        this.setState({confirming: false});
        if (this.props.closeOnConfirm) this.props.onHide();
    },

    /**
     * Function that is called to set the footer back to its normal appearance. Triggered by clicking the cancel button.
     */
    cancel: function () {
        this.setState({confirming: false});
    },

    render: function () {
        var buttons = (
            <ButtonToolbar className='pull-right'>
                <PushButton onClick={this.state.confirming ? this.cancel: this.props.onHide}>
                    {this.state.confirming ? 'Cancel': 'Close'}
                </PushButton>

                <PushButton bsStyle={this.props.style} onClick={this.state.confirming ? this.confirm: this.showConfirm}>
                    {this.props.buttonContent}
                </PushButton>
            </ButtonToolbar>
        );

        return (
            <Modal.Footer className={this.state.confirming ? ('bg-' + this.props.style): ''}>
                <Row>
                    <Col sm={6}>
                        {<span className='pull-left'>{this.state.confirming ?  this.props.message: ''}</span>}
                    </Col>
                    <Col sm={6}>
                        {buttons}
                    </Col>
                </Row>
            </Modal.Footer>
        )
    }

});

module.exports = ConfirmFooter;