/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SourceTypes
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var FlipMove = require('react-flip-move');
var Panel = require('react-bootstrap/lib/Panel');
var Overlay = require('react-bootstrap/lib/Overlay');
var Popover = require('react-bootstrap/lib/Popover');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Input = require('virtool/js/components/Base/Input.jsx');
var Checkbox = require('virtool/js/components/Base/Checkbox.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

/**
 * A component that allows the addition and removal of allowed source types. The use of restricted source types can also
 * be toggled.
 */
var SourceTypes = React.createClass({

    getInitialState: function () {
        return {
            sourceTypes: this.props.settings.get('allowed_source_types'),
            enabled: this.props.settings.get('restrict_source_types'),
            warning: null,
            value: ''
        };
    },

    componentDidMount: function () {
        this.refs.input.getInputDOMNode().focus();
        this.props.settings.on('change', this.update);
    },

    componentWillUnmount: function () {
        this.props.settings.off('change', this.update);
    },

    shouldComponentUpdate: function (nextProps, nextState) {
        return this.state !== nextState;
    },

    /**
     * Returns a reference to the input field DOM node. Used for placing the warning overlay.
     *
     * @func
     */
    getInputNode: function () {
        return this.refs.input.getInputDOMNode();
    },

    /**
     * Updates the sourceTypes and enabled state when the settings object emits and update event.
     *
     * @func
     */
    update: function () {
        this.setState(this.getInitialState());
    },

    /**
     * Adds a source type to the list of allowed source types, resulting in a settings update being sent to the server.
     * Triggered by a click on the add button.
     *
     * @param event {object} - the click event.
     * @func
     */
    add: function (event) {
        event.preventDefault();

        // Convert source type to lowercase. All source types are single words stored in lowercase. They are capitalized
        // when rendered in the application.
        var newSourceType = this.state.value.toLowerCase();
        
        // The source type cannot be an empty string...
        if (newSourceType !== '') {
            // Show warning if the source type already exists in the list.
            if (this.state.sourceTypes.indexOf(newSourceType) > -1) {
                this.setState({warning: 'Source type already exists.'});
            }

            // Show warning if the input string includes a space character.
            else if (newSourceType.indexOf(' ') > -1) {
                this.setState({warning: 'Source types may not contain spaces.'})
            }

            // If the string is acceptable add it to the existing source types list and replace the one in the
            // settings with the new one.
            else {
                var sourceTypes = _.clone(this.state.sourceTypes);
                sourceTypes.push(newSourceType);
                this.props.settings.set('allowed_source_types', sourceTypes);
                this.setState({
                    value: ''
                });
            }
        }
    },

    /**
     * Removes any warning popovers being shown. Triggered when the input field changes (fixing invalid value).
     *
     * @func
     */
    handleChange: function (event) {
        this.setState({
            value: event.target.value,
            warning: null
        });
    },

    /**
     * Remove a source type from the allowed source types list. Called when the remove icon button is clicked.
     *
     * @param sourceType {string} - the source type to remove.
     */
    remove: function (sourceType) {
        var newSourceTypes = _.remove(this.state.sourceTypes, function (n) {
            return n !== sourceType;
        });

        this.props.settings.set('allowed_source_types', newSourceTypes);
    },

    /**
     * Toggles the restriction of source types. Triggered by clicking on the 'enable this feature' button.
     */
    toggleFeature: function () {
        this.props.settings.set('restrict_source_types', !this.state.enabled);
    },


    render: function () {

        // This a buttonAddon for the text Input used to add a new sourceType.
        var saveButton = (
            <PushButton bsStyle='primary' type='submit' disabled={!this.state.enabled}>
                <Icon name='plus-square' /> Add
            </PushButton>
        );

        var listComponents = this.state.sourceTypes.map(function (sourceType) {
            var removeButton;

            // Only show remove button is the sourceTypes feature is enabled.
            if (this.state.enabled) {
                removeButton = (
                    <Icon name='remove' onClick={function () {this.remove(sourceType)}.bind(this)} pullRight />
                );
            }

            return (
                <ListGroupItem key={sourceType} disabled={!this.state.enabled}>
                    {_.capitalize(sourceType)}
                    {removeButton}
                </ListGroupItem>
            );
        }, this);

        var panelStyle = {
            height: 134 + 41 * listComponents.length,
            transition: "height 0.7s"
        };

        var containerStyle = {
            height: 50 + 41 * listComponents.length,
            transition: "height 0.7s",
            marginBottom: "20px"
        };

        return (
            <Panel style={panelStyle}>

                <div style={containerStyle}>

                    <form onSubmit={this.add}>
                        <Input
                            type='text'
                            ref='input'
                            value={this.state.value}
                            buttonAfter={saveButton}
                            disabled={!this.state.enabled}
                            onChange={this.handleChange}
                        />
                    </form>

                    <FlipMove typeName="div" className="list-group">
                        {listComponents}
                    </FlipMove>

                </div>

                <PushButton onClick={this.toggleFeature} block>
                    <Checkbox checked={this.state.enabled} /> Enable this feature
                </PushButton>

                <Overlay target={this.getInputNode} show={Boolean(this.state.warning)} placement='top' animation={false}>
                    <Popover id='source-type-warning-popover'>
                        {this.state.warning}
                    </Popover>
                </Overlay>
            </Panel>
        );
    }

});

module.exports = SourceTypes;

