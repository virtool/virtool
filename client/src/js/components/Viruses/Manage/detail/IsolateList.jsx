/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * exports IsolateList
 */

'use strict';

var React = require('react');
var ReactDOM = require('react-dom');
var FlipMove = require('react-flip-move');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('virtool/js/components/Base/PushListGroupItem.jsx');
var Badge = require('react-bootstrap/lib/Badge');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

var Isolate = require('./Isolate.jsx');
var IsolateAdd = require('./IsolateAdd.jsx');

/**
 * A component that lists the isolates associated with a virus as Isolate components.
 *
 * @class
 */
var IsolateList = React.createClass({

    propTypes: {
        // An array of isolates documents.
        data: React.PropTypes.array.isRequired,

        activeIsolateId: React.PropTypes.string,
        restrictSourceTypes: React.PropTypes.bool,
        allowedSourceTypes: React.PropTypes.array,

        // Function to call when the add button is clicked or the add form is dismissed.
        toggleAdding: React.PropTypes.func
    },

    getInitialState: function () {
        return {
            restrictSourceTypes: this.props.settings.get('restrict_source_types'),
            allowedSourceTypes: this.props.settings.get('allowed_source_types')
        };
    },

    componentDidMount: function () {
        this.props.settings.on('change', this.update)
    },

    componentWillUnmount: function () {
        this.props.settings.off('change', this.update)
    },

    /**
     * Update the component with new restricted source type settings. Triggered by an update event from the settings
     * object.
     *
     * @func
     */
    update: function () {
        this.setState(this.getInitialState());
    },

    scrollTest: function () {
        var lastId = _.last(this.props.data).isolate_id;
        var element = document.getElementById("isolate_" + lastId);
        element.scrollIntoView(true);
    },

    render: function () {

        // Render each isolate as a selectable list item
        var isolateComponents = this.props.data.map(function (isolate, index) {
            var props = {
                virusId: this.props.virusId,
                isolateId: isolate.isolate_id,
                sourceName: isolate.source_name,
                sourceType: isolate.source_type,
                default: isolate.default,

                active: isolate.isolate_id === this.props.activeIsolateId,
                selectIsolate: this.props.selectIsolate,

                canModify: this.props.canModify
            };

            return (
                <Isolate
                    key={isolate.isolate_id}
                    {...props}
                    {...this.state}
                />
            );
        }, this);

        // The final list item can display either an 'New Isolate' button or a form for adding a new isolate
        var lastComponent;

        // If the 'addingIsolate' prop is true, render the form. Otherwise display a button to open the form.
        if (this.props.canModify) {
            lastComponent = (
                <IsolateAdd
                    key="last"
                    virusId={this.props.virusId}
                    default={this.props.data.length === 0}
                    active={this.props.activeIsolateId === 'new'}
                    toggleAdding={this.props.toggleAdding}
                    {...this.state}
                    canModify={this.props.canModify}
                />
            );
        }

        if (!this.props.canModify && isolateComponents.length === 0) {
            lastComponent = (
                <ListGroupItem ref="last" key="last">
                    <div className='text-center'>
                        <Icon name='info' /> No isolates found.
                    </div>
                </ListGroupItem>
            );
        }

        var listStyle = {
            maxHeight: '576px',
            overflowY: 'scroll',
        };

        return (
            <div>
                <h5 ref="header">
                    <strong><Icon name='lab' /> Isolates</strong> <Badge>{this.props.data.length}</Badge>
                </h5>
                <FlipMove typeName="div" className="list-group" style={listStyle}>
                    {isolateComponents}
                    {lastComponent}
                </FlipMove>
                <PushButton componentClass="div" bsStyle="primary">
                    <Icon name="plus-square" /> Add Isolate
                </PushButton>
                <PushButton onClick={this.scrollTest}>
                    Scroll Test
                </PushButton>
            </div>
        );
    }

});

module.exports = IsolateList;