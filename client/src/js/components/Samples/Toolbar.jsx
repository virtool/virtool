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
        dispatcher.router.setExtra(["create"]);
    },

    render: function () {

        var button = this.state.canCreate ? (
            <Flex.Item shrink={0} pad>
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
            </div>
        )
    }

});

module.exports = SampleManageToolbar;