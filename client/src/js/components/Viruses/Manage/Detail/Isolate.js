/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Isolate
 */

import CX from "classnames";
import React from "react";
import { assign } from "lodash-es";
import { Row, Col, Collapse } from "react-bootstrap";
import { Icon, Radio, ListGroupItem } from "virtool/js/components/Base";
import { formatIsolateName } from "virtool/js/utils";

import IsolateForm from "./IsolateForm";

const IsolateHeader = (props) => (
    <h5>
        <Row>
            <Col md={9}>
                {formatIsolateName(props)}
            </Col>
            <Col md={3}>
                {props.children}
            </Col>
        </Row>
    </h5>
);

IsolateHeader.propTypes = {
    sourceType: React.PropTypes.string,
    sourceName: React.PropTypes.string,
    children: React.PropTypes.oneOfType([React.PropTypes.element, React.PropTypes.arrayOf(React.PropTypes.element)])
};


const getInitialState = (props) => ({
    // If no source type is available, "unknown" will be used if restricted source types are enabled otherwise
    // an empty string will be used.
    sourceType: props.sourceType || (props.restrictSourceTypes ? "unknown": ""),
    sourceName: props.sourceName || "",

    pendingRemoval: false,
    collapsed: true,
    editing: false
});

/**
 * An isolate document that is a list item in a list of isolates. Displays the isolate name. Has icon buttons for
 * editing and removing the isolate and setting it as the default isolate for the virus. Can be selected by clicking,
 * which displays the sequences owned by the isolate in a neighbouring panel.
 *
 * @class
 */
export default class Isolate extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    static propTypes = {
        virusId: React.PropTypes.string.isRequired,
        isolateId: React.PropTypes.string,
        sourceType: React.PropTypes.string,
        sourceName: React.PropTypes.string,
        default: React.PropTypes.bool,

        active: React.PropTypes.bool,
        allowedSourceTypes: React.PropTypes.array,
        restrictSourceTypes: React.PropTypes.bool,
        selectIsolate: React.PropTypes.func,
        canModify: React.PropTypes.bool
    };

    componentDidMount () {
        if (!this.props.isolateId) {
            document.addEventListener("keyup", this.handleKeyUp, true);
        }
    }

    componentWillReceiveProps = (nextProps) => {
        if (nextProps.sourceName !== this.props.sourceName || nextProps.sourceType !== this.props.sourceType) {
            this.setState({
                sourceType: nextProps.sourceType || (this.props.restrictSourceTypes ? "unknown" : ""),
                sourceName: nextProps.sourceName || ""
            });
        }

        if (!this.props.isolateId && nextProps.isolateId) {
            this.componentWillUnmount();
        }
    };

    componentWillUnmount () {
        document.removeEventListener("keyup", this.handleKeyUp, true);
    }

    modalEntered = () => {
        this.setState({
            collapsed: false
        });
    };

    modalExited = () => {
        this.setState({
            collapsed: true
        });
    };

    /**
     * Select the isolate as long as it is not disabled and not already the active isolate. The selection is handled by
     * the parent Isolates component.
     *
     * @param event {object} - The passed event used to prevent the default action.
     * @func
     */
    select = (event) => {
        event.preventDefault();
        if (!this.props.active) {
            this.props.selectIsolate(this.props.isolateId);
        }
    };

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

        const hadChange = (
            this.state.sourceType !== this.props.sourceType ||
            this.state.sourceName !== this.props.sourceName
        );

        // Only send an update to the server if there has been a change in the sourceType or sourceName.
        if (hadChange) {
            // Set pendingChange so the component is disabled and a spinner icon is displayed.
            this.setState({pendingChange: true}, () => {
                // Construct a replacement isolate object and send it to the server.
                dispatcher.db.viruses.request("upsert_isolate", {
                    _id: this.props.virusId,
                    new: {
                        isolate_id: this.props.isolateId,
                        source_type: this.state.sourceType,
                        source_name: this.state.sourceName
                    }
                }).success(this.toggleEditing);
            });
        }

        // If the data did not change, just close the form and save sending it to the server.
        else {
            this.toggleEditing();
        }
    };

    /**
     * Remove the isolate as long as it"s not disabled. The removal button is only shown if the isolate is the active
     * isolate, so this method can only successfully be called if props.active is true. The removal is handled by the
     * parent Isolate component.
     *
     * @param event {object} - The passed event used to prevent the default action.
     * @func
     */
    remove = (event) => {
        event.preventDefault();

        // First set state to indicate that the isolate is pending removal. Then, send a request to remove the
        // isolate.
        if (this.props.active) {
            this.setState({pendingRemoval: true}, () => {
                dispatcher.db.viruses.request("remove_isolate", {
                    _id: this.props.virusId,
                    isolate_id: this.props.isolateId
                });
            });
        }
    };

    /**
     * Set the isolate as the default isolate. This method can be called by any Isolate component, not just the active
     * one. Setting the default isolate is handled by the parent Isolate component, so the isolate_id must be passed up.
     *
     * @func
     */
    setAsDefault = () => {
        dispatcher.db.viruses.request("set_default_isolate", {
            _id: this.props.virusId,
            isolate_id: this.props.isolateId
        });
    };

    /**
     * Toggles whether the isolate is being edited. Triggered by clicking the edit or cancel icon buttons.
     *
     * @func
     */
    toggleEditing = () => {
        const newState = assign(this.getInitialState(), {editing: !this.state.editing});

        if (this.state.editing) {
            this.setState(newState, () => {
                document.removeEventListener("keyup", this.handleKeyUp, true);
            });
        } else {
            this.setState(newState, () => {
                document.addEventListener("keyup", this.handleKeyUp, true);
            });
        }
    };

    handleKeyUp = (event) => {
        if (event.keyCode === 27) {
            event.stopImmediatePropagation();
            this.toggleEditing();
        }
    };

    render () {

        const itemProps = {
            onClick: this.props.active ? null: this.select,
            disabled: this.state.pendingRemoval,
            allowFocus: this.props.active,

            className: CX({
                band: this.props.active
            })
        };

        const itemStyle = {
            background: this.state.editing ? "#fcf8e3": null,
            transition: "0.7s background"
        };

        let icons;

        if (this.props.canModify) {
            icons = (
                <div className="icon-group">
                    {this.props.active && !this.state.editing ? (
                        <Icon
                            name="pencil"
                            bsStyle="warning"
                            onClick={this.toggleEditing}
                        />
                    ): null}
                    {this.props.active && !this.state.editing ? (
                        <Icon
                            name="remove"
                            bsStyle="danger"
                            pending={this.state.pendingRemoval}
                            onClick={this.remove}
                        />
                    ): null}
                    {this.state.editing ? (
                        <Icon
                            name="floppy"
                            bsStyle="primary"
                            onClick={this.save}
                        />
                    ): null}
                    {this.state.editing ? (
                        <Icon
                            name="cancel-circle"
                            bsStyle="danger"
                            onClick={this.toggleEditing}
                        />
                    ): null}
                    <Radio
                        onClick={this.setAsDefault}
                        checked={this.props.default}
                    />
                </div>
            )

        }

        return (
            <ListGroupItem {...itemProps} style={itemStyle}>
                <IsolateHeader sourceType={this.state.sourceType} sourceName={this.state.sourceName}>
                    {icons}
                </IsolateHeader>
                <Collapse
                    in={this.props.canModify && this.state.editing}
                    onExited={this.modalExited}
                    onEntered={this.modalEntered}
                >
                    <div>
                        <div style={{height: "15px"}} />
                        <IsolateForm
                            sourceType={this.state.sourceType}
                            sourceName={this.state.sourceName}
                            allowedSourceTypes={this.props.allowedSourceTypes}
                            restrictSourceTypes={this.props.restrictSourceTypes}
                            onChange={this.handleChange}
                            onSubmit={this.save}
                        />
                    </div>
                </Collapse>
            </ListGroupItem>
        );
    }
}
