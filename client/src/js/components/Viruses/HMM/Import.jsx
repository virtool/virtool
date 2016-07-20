/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ImportViruses
 */

'use strict';

var React = require('react');
var Dropzone = require('react-dropzone');
var Request = require('superagent');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Modal = require('react-bootstrap/lib/Modal');
var Alert = require('react-bootstrap/lib/Alert');
var Panel = require('react-bootstrap/lib/Panel');
var Button = require('react-bootstrap/lib/Button');
var ButtonToolbar = require('react-bootstrap/lib/ButtonToolbar');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var ByteSize = require('virtool/js/components/Base/ByteSize.jsx');

/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
var ImportViruses = React.createClass({

    getInitialState: function () {
        return {
            file: null,
            fileId: null,
            pending: false,
            warning: null,
            added: null
        };
    },

    handleDrop: function (files) {
        this.setState(_.extend(this.getInitialState(), {file: files[0]}));
    },

    upload: function () {
        this.setState({pending: true}, function () {
            var component = this;

            var request = Request.post('/upload');
            request.attach(this.state.file.name, this.state.file);
            request.end(function (data, res) {
                component.setState({fileId: res.text}, component.importData);
            });
        });
    },

    importData: function () {
        dispatcher.collections.hmm.request(
            'import_data',
            {file_id: this.state.fileId},
            this.onSuccess,
            this.onFailure
        );
    },

    onSuccess: function (data) {
        this.setState(_.extend(this.getInitialState(), {added: data.message}));
    },

    onFailure: function (data) {
        this.setState({warning: data.message});
    },

    acceptWarnings: function () {
        this.setState(this.getInitialState());
    },

    hide: function () {
        this.setState(this.getInitialState(), function () {
            this.props.onHide();
        })
    },

    render: function () {
        
        var modalProps = _.extend(this.props, {onHide: this.hide});

        var dropzoneProps = {
            onDrop: this.handleDrop,
            multiple: false,
            disableClick: true
        };

        var style = {
            width: '100%',
            height: 'auto',
            border: '1px solid #dddddd',
            borderColor: '#dddddd',
            padding: '15px',
            marginBottom: '15px'
        };

        var activeStyle = _.extend({
            backgroundColor: '#337ab7',
            borderColor: '#337ab7',
            color: '#ffffff'
        }, style);

        var content;

        var button;

        if (this.state.file) {
            button = (
                <Button bsStyle='primary' onClick={this.upload} block>
                    <Icon name='arrow-up' pending={this.state.pending} /> Import
                </Button>
            );
        }

        var dropzoneContent = 'Drag file here.';

        if (this.state.file) {
            var iconName = _.includes(this.state.file.name, '.gz') ? 'file-zip': 'file-text';

            dropzoneContent = (
                <span>
                    <Icon name={iconName} /> {this.state.file.name} (<ByteSize bytes={this.state.file.size} />)
                </span>
            );
        }

        content = (
            <div>
                <Row>
                    <Col md={12}>
                        <Dropzone style={style} activeStyle={activeStyle} {...dropzoneProps} ref='dropzone'>
                            <div className='drag-area text-center'>
                                {dropzoneContent}
                            </div>
                        </Dropzone>
                    </Col>
                </Row>

                {button}
            </div>
        );

        return (
            <Modal ref='modal' {...modalProps}>

                <Modal.Header {...modalProps} closeButton>
                    Import Viruses
                </Modal.Header>

                <Modal.Body {...modalProps}>
                    <Row>
                        <Col md={12}>
                            <Panel>
                                Import annotations from a Virtool-compatible JSON or gzip-compressed JSON file.
                            </Panel>
                        </Col>
                    </Row>

                    {content}

                </Modal.Body>
            </Modal>
        );



    }
});

module.exports = ImportViruses;
