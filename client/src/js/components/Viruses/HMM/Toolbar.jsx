/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports VirusToolbar
 */

'use strict';

var React = require('react');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

/**
 * A toolbar component rendered at the top of the virus manager table. Allows searching of viruses by name and
 * abbreviation. Includes a button for creating a new virus.
 */
var VirusToolbar = React.createClass({

    propTypes: {
        onChange: React.PropTypes.func
    },

    getInitialState: function () {
        // The state showAdd is true when the modal should be visible.
        return {
            canModify: dispatcher.user.permissions.modify_hmm
        };
    },

    componentDidMount: function () {
        this.refs.input.focus();
        dispatcher.user.on('change', this.onUserChange);
    },

    componentWillUnmount: function () {
        dispatcher.user.off('change', this.onUserChange);
    },

    onUserChange: function () {
        this.setState({
            canModify: dispatcher.user.permissions.modify_hmm
        });
    },

    /**
     * Updates the function used to filter virus documents. Triggered by a change in the search input field.
     *
     * @func
     */
    handleChange: function () {
        var re = new RegExp(this.refs.input.value, 'i');

        var filterFunction = function (document) {
            return re.test(document.label) || re.test(document.cluster);
        };

        this.props.onChange(filterFunction);
    },

    /**
     * Changes state to show the add or export modal form. Triggered by clicking the a menu item.
     *
     * @func
     */
    showImport: function () {
        dispatcher.router.setExtra(["import"])
    },

    render: function () {

        var button;

        var mayImport = dispatcher.collections.hmm.documents.length === 0;

        if (this.state.canModify) {
            button = (
                <Flex.Item shrink={0} pad>
                    <PushButton bsStyle="primary" onClick={this.showImport} disabled={!mayImport}>
                        <Icon name="new-entry" /> Import
                    </PushButton>
                </Flex.Item>
            );
        }

        return (
            <div style={{marginBottom: '15px'}}>
                <Flex>
                    <Flex.Item grow={2}>
                        <div className='input-group'>
                            <span id='find-addon' className='input-group-addon'>
                                <Icon name='search' /> Find
                            </span>
                            <input
                                ref='input'
                                aria-describedby='find-addon'
                                className='form-control'
                                type='text'
                                placeholder='Definition or cluster'
                                onChange={this.handleChange}
                            />
                        </div>
                    </Flex.Item>

                    {button}
                </Flex>
            </div>
        );
    }

});

module.exports = VirusToolbar;