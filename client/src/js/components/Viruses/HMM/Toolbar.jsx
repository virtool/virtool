/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HMMToolbar
 */

'use strict';

var React = require('react');
var Dropdown = require('react-bootstrap/lib/Dropdown');
var MenuItem = require('react-bootstrap/lib/MenuItem');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

/**
 * A toolbar component rendered at the top of the virus manager table. Allows searching of viruses by name and
 * abbreviation. Includes a button for creating a new virus.
 */
var HMMToolbar = React.createClass({

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
     * @param eventKey {number} - the event key.
     * @func
     */
    handleSelect: function (eventKey) {
        dispatcher.router.setExtra([eventKey]);
    },

    render: function () {

        var mayImport = dispatcher.db.hmm.count() === 0;

        var menu = (
            <Flex.Item shrink={0} grow={0} pad>
                <Dropdown id='hmm-dropdown' pullRight onSelect={this.handleSelect}>
                    <Dropdown.Toggle noCaret>
                        <Icon name='menu' />
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                        <MenuItem eventKey="import" disabled={!this.state.canModify || !mayImport}>
                            <Icon name='new-entry' /> Import Annotations
                        </MenuItem>
                        <MenuItem eventKey="files" disabled={!this.state.canModify}>
                            <Icon name='folder-open' /> View Files
                        </MenuItem>
                    </Dropdown.Menu>
                </Dropdown>
            </Flex.Item>
        );

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

                    {menu}
                </Flex>
            </div>
        );
    }

});

module.exports = HMMToolbar;