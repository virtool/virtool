/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Lifecycle
 */

'use strict';

var React = require('react');
var Panel = require('react-bootstrap/lib/Panel');
var ButtonToolbar = require('react-bootstrap/lib/ButtonToolbar');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');

/**
 * A component that allows the addition and removal of allowed source types. The use of restricted source types can also
 * be toggled.
 */
var Lifecycle = React.createClass({

    getInitialState: function () {
        return {
            pendingReload: false
        };
    },

    reload: function () {
        this.setState({pendingReload: true}, function () {
            dispatcher.send({
                collectionName: 'dispatcher',
                methodName: 'reload',
                message: {}
            }).success(this.onReloaded);
        });
    },

    onReloaded: function () {
        var domain = dispatcher.settings.get('server_address') + ':' + dispatcher.settings.get('server_port');
        var protocol = dispatcher.settings.get('use_ssl') ? 'https': 'http';
        var newLocation = protocol + "://" + domain;
        
        location.assign(newLocation);
    },

    shutdown: function () {
        location.hash = '#home/welcome';
        
        dispatcher.send({
            collectionName: 'dispatcher',
            methodName: 'shutdown',
            message: {}
        });
    },

    render: function () {

        return (
            <Panel>
                <ButtonToolbar>
                    <PushButton bsStyle='warning' onClick={this.reload}>
                        <Icon name='reset' pending={this.state.pendingReload} /> Reload
                    </PushButton>

                    <PushButton bsStyle='danger' onClick={this.shutdown}>
                        <Icon name='switch' pending={this.state.pendingShutdown} /> Shutdown
                    </PushButton>
                </ButtonToolbar>
            </Panel>
        );
    }

});

module.exports = Lifecycle;

