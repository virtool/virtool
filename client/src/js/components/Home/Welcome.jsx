var React = require('react');
var Request = require('superagent');
var Dropzone = require('react-dropzone');
var Panel = require('react-bootstrap/lib/Panel');
var Alert = require('react-bootstrap/lib/Alert');
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

    onDrop: function (files) {

        files.forEach(function (file) {
            dispatcher.db.samples.request("authorize_upload", {
                name: file.name,
                size: file.size
            }).success(function (data) {

                Request.post('/upload/' + data.file_id)
                    .send(file)
                    .end(function () {
                        console.log("done");
                    });
            });
        });
    },

    upload: function (event) {
        event.preventDefault();
        // var request = Request.post('/upload');
        // request.attach(this.state.file.name, this.state.file);

        console.log(event.target.value);
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
                    <Panel header="Upload Test">
                        <Dropzone onDrop={this.onDrop}>
                            Drag here, or click to upload
                        </Dropzone>
                    </Panel>
                </div>
            );
        }

        return <div>{content}</div>;
    }
});

module.exports = View;