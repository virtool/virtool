/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports IsolateAdd
 */

import CX from "classnames";
import React from "react";
import { Collapse } from "react-bootstrap";
import { Icon, Flex, FlexItem, Button } from "virtool/js/components/Base";

import IsolateForm from "./IsolateForm";

const getInitialState = (props) => ({
    // If no source type is available, "unknown" will be used if restricted source types are enabled otherwise
    // an empty string will be used.
    sourceType: props.restrictSourceTypes ? "unknown": "",
    sourceName: "",

    collapsed: true,
    pending: false
});

export default class IsolateAdd extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    static propTypes = {
        virusId: React.PropTypes.string.isRequired,
        isolateId: React.PropTypes.string,

        active: React.PropTypes.bool,
        allowedSourceTypes: React.PropTypes.array,
        restrictSourceTypes: React.PropTypes.bool,

        updateScroll: React.PropTypes.func,
        toggleAdding: React.PropTypes.func
    };

    componentWillReceiveProps = (nextProps) => {
        if (!this.props.active && nextProps.active) {
            document.addEventListener("keyup", this.handleKeyUp, true);
        }

        if (this.props.active && !nextProps.active) {
            this.setState(getInitialState(this.props), () => {
                document.removeEventListener("keyup", this.handleKeyUp, true);
            });
        }
    };

    componentWillUnmount () {
        document.removeEventListener("keyup", this.handleKeyUp, true);
    }

    collapseEnter = () => this.formNode.focus();

    collapseEntered = () => {
        this.setState({collapsed: false}, () => {
            this.props.updateScroll();
            this.formNode.focus();
            this.node.scrollIntoView({
                block: "end",
                behaviour: "smooth"
            });
        });
    };

    collapseExited = () => this.setState({collapsed: true}, this.props.updateScroll);

    /**
     * Handle a change from the isolate form. Updates state to reflect the current input values.
     *
     * @param changeObject {object} - an object of field values keyed by field names.
     * @func
     */
    handleChange = (changeObject) => {
        this.setState(changeObject);
    };

    /**
     * Called when the form is submitted or the saveIcon is clicked. If the sourceName or sourceType have changed, the
     * updated data is sent to the server. When a response is received, the form is closed. Saving with no change in the
     * data with simply close the form.
     *
     * @param event {object} - The passed event. Used for preventing the default action.
     * @func
     */
    save = (event) => {
        event.preventDefault();

        // Set pendingChange so the component is disabled and a spinner icon is displayed.
        this.setState({pending: true}, function () {
            // Construct a replacement isolate object and send it to the server.
            dispatcher.db.viruses.request("upsert_isolate", {
                _id: this.props.virusId,
                new: {
                    isolate_id: this.props.isolateId,
                    source_type: this.state.sourceType,
                    source_name: this.state.sourceName
                }
            }).success(this.props.toggleAdding);
        });
    };

    handleKeyUp = (event) => {
        if (event.keyCode === 27) {
            event.stopImmediatePropagation();
            this.props.toggleAdding();
        }
    };

    render () {

        let buttons;

        if (this.props.active) {
            buttons = (
                <Flex justifyContent="flex-end">
                    <FlexItem>
                        <Button onClick={this.props.toggleAdding}>
                            Cancel
                        </Button>
                    </FlexItem>
                    <FlexItem pad>
                        <Button bsStyle="primary" onClick={this.save}>
                            <Icon name="floppy" /> Save
                        </Button>
                    </FlexItem>
                </Flex>
            );
        }

        const itemProps = {
            className: CX({
                "list-group-item": true,
                "hoverable": !this.props.active,
                "band": this.props.active
            }),

            style: {
                background: this.props.active ? "#dbe9f5": null,
                transition: "0.7s background"
            },

            onClick: this.state.collapsed ? this.props.toggleAdding: null
        };

        return (
            <div ref={(node) => this.node = node} {...itemProps}>
                <Collapse in={!this.props.active}>
                    <div className="text-center">
                        <Icon name="plus-square" bsStyle="primary" /> Add Isolate
                    </div>
                </Collapse>
                <Collapse
                    in={this.props.active}
                    onExited={this.collapseExited}
                    onEnter={this.collapseEnter}
                    onEntered={this.collapseEntered}
                >
                    <div>
                        <div style={{height: "15px"}} />
                        <IsolateForm ref={(node) => this.formNode = node}
                            sourceType={this.state.sourceType}
                            sourceName={this.state.sourceName}
                            allowedSourceTypes={this.props.allowedSourceTypes}
                            restrictSourceTypes={this.props.restrictSourceTypes}
                            onChange={this.handleChange}
                            onSubmit={this.save}
                        />
                        {buttons}
                    </div>
                </Collapse>
            </div>
        );
    }
}
