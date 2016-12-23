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

import React from "react";
import { Panel, ButtonToolbar } from 'react-bootstrap';
import { Button, Icon } from "virtool/js/components/Base";

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
                interface: 'dispatcher',
                method: 'reload',
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
            interface: 'dispatcher',
            method: 'shutdown',
            message: {}
        });
    },

    render: function () {

        return (
            <Panel>
                <ButtonToolbar>
                    <Button bsStyle='warning' onClick={this.reload}>
                        <Icon name='reset' pending={this.state.pendingReload} /> Reload
                    </Button>

                    <Button bsStyle='danger' onClick={this.shutdown}>
                        <Icon name='switch' pending={this.state.pendingShutdown} /> Shutdown
                    </Button>
                </ButtonToolbar>
            </Panel>
        );
    }

});

module.exports = Lifecycle;

