/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ExportViruses
 */

'use strict';


var React = require('react');
var Modal = require('react-bootstrap/lib/Modal');
var Panel = require('react-bootstrap/lib/Panel');
var Input = require('react-bootstrap/lib/Input');

var PushButton = require('virtool/js/components/Base/PushButton.jsx');
var ByteSize = require('virtool/js/components/Base/ByteSize.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');

/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
var ExportViruses = React.createClass({

    getInitialState: function () {
        return {
            filename: 'viruses.json',
            download: null,
            pending: false
        };
    },

    handleClick: function () {
        this.setState({download: false, pending: true}, function () {
            dispatcher.db.viruses.request('export', null, this.onExportSuccess);
        });
    },

    handleSubmit: function (event) {
        event.preventDefault();
        dispatcher.db.viruses.request('importData', {fileId: this.refs.text.getValue()});
    },

    onExportSuccess: function (data) {
        this.setState({
            download: data,
            pending: false
        });
    },

    hide: function () {
        this.setState(this.getInitialState());
        this.props.onHide();
    },

    render: function () {

        var button;

        var buttonProps = {
            block: true,
            bsStyle: 'primary'
        };

        if (this.state.download) {
            var props = {
                href: 'download/' + this.state.download.filename,
                download: 'viruses.json.gz'
            };

            button = (
                <PushButton {...props} {...buttonProps}>
                    <Icon name='arrow-down' /> Download (<ByteSize bytes={this.state.download.size} />)
                </PushButton>
            );
        } else {
            button = (
                <PushButton {...buttonProps} onClick={this.handleClick} disabled={this.state.pending}>
                    <Icon name='export' pending={this.state.pending} /> Export
                </PushButton>
            );
        }

        var modalProps = _.extend(this.props, {onHide: this.hide});

        return (
            <Modal {...modalProps}>

                <Modal.Header {...modalProps} closeButton>
                    Export Viruses
                </Modal.Header>

                <Modal.Body {...modalProps}>
                    <Panel>
                        Export all viruses as they exist in the most recent index build. The generated JSON file can
                        be imported into a new Virtool instance. History will not be preserved.
                    </Panel>

                    {button}
                </Modal.Body>


            </Modal>
        );



    }
});

module.exports = ExportViruses;