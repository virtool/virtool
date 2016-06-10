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
var Dropdown = require('react-bootstrap/lib/Dropdown');
var MenuItem = require('react-bootstrap/lib/MenuItem');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

var Add = require('./Add.jsx');
var Export = require('./Export.jsx');
var Import = require('./Import.jsx');

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
            showAdd: false,
            showExport: false,
            showImport: false,

            flaggedOnly: false,

            canAdd: dispatcher.user.permissions.add_virus,
            canModify: dispatcher.user.permissions.modify_virus
        };
    },

    componentDidMount: function () {
        // Focus on the input field when the component is ready.
        this.refs.input.focus();

        dispatcher.user.on('change', this.onUserChange);
    },

    componentWillUnmount: function () {
        dispatcher.user.off('change', this.onUserChange);
    },

    onUserChange: function () {
        this.setState({
            canAdd: dispatcher.user.permissions.add_virus,
            canModify: dispatcher.user.permissions.modify_virus
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
            return (
                (re.test(document.name) || re.test(document.abbreviation)) &&
                (!this.state.flaggedOnly || (this.state.flaggedOnly && document.modified))
            );
        }.bind(this);

        this.props.onChange(filterFunction);
    },

    /**
     * Changes state to show the add or export modal form. Triggered by clicking the a menu item.
     *
     * @param event {object} - the select event.
     * @param eventKey {number} - the event key.
     * @func
     */
    handleSelect: function (event, eventKey) {
        switch (eventKey) {

            case 1:
                this.setState({showAdd: true});
                break;

            case 2:
                this.setState({showExport: true});
                break;

            case 3:
                this.setState({showImport: true});
                break;
        }
    },

    toggleFlaggedOnly: function () {
        this.setState({
            flaggedOnly: !this.state.flaggedOnly
        }, this.handleChange);
    },

    /**
     * Changes state to hide the add virus modal form. Triggered as the onHide prop for the modal.
     */
    hideModals: function () {
        this.setState(this.getInitialState(), function () {
            document.getElementById('virus-menu-dropdown').blur();
        });
    },

    render: function () {

        var menu;

        if (this.state.canAdd || this.state.canModify) {
            menu = (
                <Dropdown id='virus-menu-dropdown' pullRight onSelect={this.handleSelect}>
                    <Dropdown.Toggle noCaret ref='menuButton'>
                        <Icon name='menu' />
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                        <MenuItem eventKey={1} disabled={!this.state.canAdd}>
                            <Icon name='new-entry' /> New
                        </MenuItem>
                        <MenuItem eventKey={2} disabled={!this.state.canModify}>
                            <Icon name='export' /> Export
                        </MenuItem>
                        <MenuItem eventKey={3} disabled={!this.state.canAdd}>
                            <Icon name='new-entry' /> Import
                        </MenuItem>
                    </Dropdown.Menu>
                </Dropdown>
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
                                placeholder='Name or Abbreviation'
                                onChange={this.handleChange}
                            />
                        </div>
                    </Flex.Item>

                    <Flex.Item pad>
                        <PushButton onClick={this.toggleFlaggedOnly} active={this.state.flaggedOnly}>
                            <Icon name='flag' bsStyle='warning' />
                        </PushButton>
                    </Flex.Item>

                    <Flex.Item pad>
                        {menu}
                    </Flex.Item>
                </Flex>

                <Add
                    show={this.state.showAdd}
                    onHide={this.hideModals}
                />

                <Export
                    show={this.state.showExport}
                    onHide={this.hideModals}
                />

                <Import
                    show={this.state.showImport}
                    enableHiding={this.enableHiding}
                    disableHiding={this.disableHiding}
                    onHide={this.hideModals}
                />

            </div>
        );
    }

});

module.exports = VirusToolbar;