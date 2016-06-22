/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ReadSelector
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var ReactDOM = require('react-dom');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var Overlay = require('react-bootstrap/lib/Overlay');
var Popover = require('react-bootstrap/lib/Popover');
var Input = require('react-bootstrap/lib/Input');
var Panel = require('react-bootstrap/lib/Panel');
var Label = require('react-bootstrap/lib/Label');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Modal = require('react-bootstrap/lib/Modal');

var ReadItem = require('./Read.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

/**
 * A main view for importing samples from FASTQ files. Importing starts an import job on the server.
 *
 * @class
 */
var ReadSelector = React.createClass({

    propTypes: {
        selected: React.PropTypes.arrayOf(React.PropTypes.string)
    },

    getInitialState: function () {
        return {
            reads: dispatcher.collections.reads.documents,
            selected: [],
            filter: ''
        };
    },

    getValue: function () {
        return this.state.selected;
    },

    clearSelected: function () {
        this.setState({selected: []});
    },

    handleFilter: function (event) {
        this.setState({
            filter: event.target.value
        });
    },

    handleSelect: function (selectedId) {
        this.setState({
            selected: _.xor(this.state.selected, [selectedId])
        });
    },

    reset: function () {
        this.setState({
            selected: [],
            filter: ''
        });
    },

    componentDidMount: function () {
        // Listen for changes to the reads collection
        dispatcher.listen('reads');
        dispatcher.collections.reads.on('change', this.update);
    },

    componentWillUnmount: function () {
        // Unbind all callbacks
        dispatcher.unlisten('reads');
        dispatcher.collections.reads.off('change', this.update);
    },

    update: function () {
        this.setState({reads: dispatcher.collections.reads.documents});
    },

    getPanelDOMNode: function () {
        return ReactDOM.findDOMNode(this.refs.panel);
    },

    render: function () {

        var loweredFilter = this.state.filter.toLowerCase();

        var readComponents = _.sortBy(this.state.reads, '_id').map(function (read) {
            if (read._id.toLowerCase().indexOf(loweredFilter) > -1) {
                return (
                    <ReadItem
                        key={read._id}
                        {...read}
                        selected={_.includes(this.state.selected, read._id)}
                        onSelect={this.handleSelect}
                    />
                );
            }
        }, this);

        var overlay;

        if (this.props.readError) {
            // Set up an overlay to display if there is an error in state.
            var overlayProps = {
                target: this.getPanelDOMNode,
                animation: false,
                placement: 'top'
            };

            overlay = (
                <Overlay {...overlayProps} show={true}>
                    <Popover id='read-error-popover'>
                        <span className='text-danger'>At least one read file must be attached to the sample</span>
                    </Popover>
                </Overlay>
            );
        }
        
        return (
            <div>
                <label className='control-label'>
                    Read Files <Label>{this.state.selected.length}/{this.state.reads.length} selected</Label>
                </label>

                <Panel ref='panel'>
                    <div style={{display: 'flex'}}>
                        <div style={{flex: '1 1 auto'}}>
                            <Input
                                type="text"
                                onChange={this.handleFilter}
                                value={this.state.filter}
                                placeholder="Filter by filename..."
                            />
                        </div>
                        <div style={{flex: '0 0 auto', paddingLeft: '5px'}}>
                            <PushButton onClick={this.reset}>
                                <Icon name='reset' />
                            </PushButton>
                        </div>
                    </div>

                    <Panel style={{minHeight: '420px', maxHeight: '420px', overflowY: 'scroll'}}>
                        <ListGroup fill>
                            {readComponents}
                        </ListGroup>
                    </Panel>
                </Panel>

                {overlay}
            </div>
        );
    }
});

module.exports = ReadSelector;