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

import React from "react";
import { Row, Col, Modal, ButtonToolbar } from "react-bootstrap";
import { Icon, Button } from "virtool/js/components/Base";

/**
 * A special Modal.Footer component that contains an action button customized by the user, and a cancel button. When the
 * action button is clicked, the user is prompted to confirm they are sure of their action.
 */
export class ConfirmFooter extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            confirming: false
        };
    }

    static propTypes = {
        // Function to call if the modal is hiding.
        onHide: React.PropTypes.func.isRequired,

        // Content to place in the action button.
        buttonContent: React.PropTypes.element,

        // String to pass in for bsStyle on the button.
        style: React.PropTypes.string,

        // Function to call when the user confirms they are sure of their action.
        callback: React.PropTypes.func,

        // Warning message to display. By default it is "Are you sure?".
        message: React.PropTypes.string,

        // Close the modal when the confirm button is clicked.
        closeOnConfirm: React.PropTypes.bool
    };

    static defaultProps = {
        buttonContent: <span><Icon name="checkmark-circle"/> Submit</span>,
        style: "danger",
        message: "Are you sure?",
        closeOnConfirm: true
    };

    /**
     * Switch the footer to confirm mode. The footer gains a red background, confirmation message, and altered buttons.
     */
    showConfirm = () => {
        this.setState({
            confirming: true
        });
    };

    /**
     * Function that is called when the confirm button is clicked. Calls the callback function prop, then
     */
    confirm = () => {
        this.props.callback();

        this.setState({
            confirming: false
        });

        if (this.props.closeOnConfirm) {
            this.props.onHide();
        }
    };

    /**
     * Function that is called to set the footer back to its normal appearance. Triggered by clicking the cancel button.
     */
    cancel = () => {
        this.setState({
            confirming: false
        });
    };

    render () {

        const buttons = (
            <ButtonToolbar className="pull-right">
                <Button onClick={this.state.confirming ? this.cancel: this.props.onHide}>
                    {this.state.confirming ? "Cancel": "Close"}
                </Button>

                <Button bsStyle={this.props.style} onClick={this.state.confirming ? this.confirm: this.showConfirm}>
                    {this.props.buttonContent}
                </Button>
            </ButtonToolbar>
        );

        return (
            <Modal.Footer className={this.state.confirming ? (`"bg-${this.props.style}`): ""}>
                <Row>
                    <Col sm={6}>
                        {<span className="pull-left">{this.state.confirming ?  this.props.message: ""}</span>}
                    </Col>
                    <Col sm={6}>
                        {buttons}
                    </Col>
                </Row>
            </Modal.Footer>
        )
    }
}
