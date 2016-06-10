/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AlertModal
 */

'use strict';

var React = require("react");
var Modal = require("react-bootstrap/lib/Modal");
var Button = require("react-bootstrap/lib/Button");
var ButtonToolbar = require("react-bootstrap/lib/ButtonToolbar");
var Icon = require('virtool/js/components/Base/Icon.jsx');

/**
 * A base modal that displays a message defined by its child content (this.props.children) and two buttons for the user
 * to accept or cancel in response. The appearance of the accept button and the action taken on clicking it can be
 * customized with props.
 */
var AlertModal = React.createClass({

    propTypes: {
        show: React.PropTypes.bool.isRequired, // Show modal if set to `true`.
        onHide: React.PropTypes.func.isRequired, // Function to call when the modal needs to hide (eg. click close).
        onAccept: React.PropTypes.func, // Function to call when the accept button is clicked.
        buttonStyle: React.PropTypes.string, // The `bsStyle` to be applied to the accept button.
        buttonContent: React.PropTypes.element // The content to be placed in the accept button (HTML).
    },

    getDefaultProps: function () {
        return {
            onAccept: function () {},
            buttonStyle: 'primary',
            buttonContent: <span><Icon name='checkmark-circle' /> Confirm</span>
        };
    },

    /**
     * Triggered when the accept button is clicked. Calls a function that does nothing by default, but can be overridden
     * to set a custom behaviour. After this function is called, the modal is closed.
     */
    handleAccept: function () {
        // The callback triggered when the accept button is clicked.
        this.props.onAccept();
        // Hides the modal after the alert message action has been carried out.
        this.props.onHide();
    },

    render: function () {
        /**
         * Returns a React-Bootstrap modal with the body containing the alert message and a footer containing buttons
         * for canceling and accepting the alert message.
         *
         * @return {ReactElement} A modal element used to confirm an action with the user.
         */
        return (
            <Modal {...this.props}>
                <Modal.Body {...this.props}>
                    {/* The warning about the action that the user is either accepting or canceling */}
                    {this.props.children}
                </Modal.Body>
                <Modal.Footer {...this.props}>
                    <ButtonToolbar className="pull-right">
                        {/* The cancel button which trigger this.props.onHide when clicked. */}
                        <Button onClick={this.props.onHide}>
                            Cancel
                        </Button>
                        {/* The accept button which triggers this.props.onAccept when clicked. */}
                        <Button bsStyle={this.props.buttonStyle} onClick={this.handleAccept}>
                            {this.props.buttonContent}
                        </Button>
                    </ButtonToolbar>
                </Modal.Footer>
            </Modal>
        );
    }
});

module.exports = AlertModal;