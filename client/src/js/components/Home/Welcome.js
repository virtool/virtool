import React from "react";
var Panel = require('react-bootstrap/lib/Panel');
var Table = require('react-bootstrap/lib/Table');

var View = React.createClass({

    getInitialState: function () {
        return {
            settings: dispatcher.settings.data || null
        }
    },

    componentDidMount: function () {
        dispatcher.settings.on('change', this.update);
    },

    componentWillUnmount: function () {
        dispatcher.settings.off('change', this.update);
    },

    update: function () {
        this.setState({settings: dispatcher.settings.data});
    },

    render: function () {
        var content;

        if (this.state.settings) {

            content = (
                <div>
                    <Panel header='Virtool'>
                        <a href="/doc/index.html?v=2" target="_blank">Documentation</a> (incomplete)
                    </Panel>
                    <Panel header='Server'>
                        <Table fill bordered>
                            <tbody>
                                <tr>
                                    <th>Version</th>
                                    <td>{dispatcher.settings.get('server_version')}</td>
                                </tr>
                                <tr>
                                    <th>Address</th>
                                    <td>{this.state.settings.server_address}:{this.state.settings.server_port}</td>
                                </tr>
                                <tr>
                                    <th>Server ID</th>
                                    <td>{this.state.settings.server_id}</td>
                                </tr>
                            </tbody>
                        </Table>
                    </Panel>
                </div>
            );
        }

        return <div>{content}</div>;
    }
});

module.exports = View;