/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SampleManageToolbar
 */

var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Button = require('react-bootstrap/lib/Button');
var ButtonToolbar = require('react-bootstrap/lib/ButtonToolbar');
var Popover = require('react-bootstrap/lib/Popover');
var OverlayTrigger = require('react-bootstrap/lib/OverlayTrigger');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

var Filter = require('./Filter.jsx');
var Create = require('./Create/Create.jsx');

/**
 * Serves as a filterComponent for the SamplesTable component. The sample name is the only field that can be sorted by.
 *
 * @class
 */
var SampleManageToolbar = React.createClass({

    propTypes: {
        onChange: React.PropTypes.func.isRequired
    },

    getInitialState: function () {
        return {
            show: false,
            canCreate: dispatcher.user.permissions.add_sample
        };
    },

    componentDidMount: function () {
        dispatcher.user.on('change', this.onUserChange);
    },

    componentWillUnmount: function () {
        dispatcher.user.off('change', this.onUserChange);
    },

    onUserChange: function () {
        this.setState({
            canCreate: dispatcher.user.permissions.add_sample
        });
    },

    show: function () {
        this.setState({show: this.state.canCreate});
    },

    hide: function () {
        this.setState({show: false});
    },

    render: function () {

        var button = this.state.canCreate ? (
            <Flex.Item pad>
                <PushButton bsStyle='primary' onClick={this.show}>
                    <Icon name='new-entry' /> Create
                </PushButton>
            </Flex.Item>
        ): null;

        return (
            <div>
                <Flex>
                    <Flex.Item grow={2}>
                        <Filter {...this.props} />
                    </Flex.Item>
                    {button}
                </Flex>

                <Create show={this.state.show} onHide={this.hide} />
            </div>
        )
    }

});

module.exports = SampleManageToolbar;