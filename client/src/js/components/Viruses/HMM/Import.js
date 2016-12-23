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

import React from "react";
import Dropzone from 'react-dropzone';
import Request from 'superagent';
import { Row, Col, Modal, Alert, Panel, ButtonToolbar } from "react-bootstrap";

import { Icon, Button } from "virtool/js/components/Base/Icon";
import { byteSize } from 'virtool/js/utils';

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

    modalExited: function () {
        this.setState(this.getInitialState());
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
        dispatcher.db.hmm.request('import_data', {file_id: this.state.fileId}).success(function () {
            this.setState(_.extend(this.getInitialState(), {added: data.message}));
        }, this).failure(function () {
            this.setState({warning: data.message});
        });
    },

    acceptWarnings: function () {
        this.setState(this.getInitialState());
    },

    render: function () {

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
                    <Icon name={iconName} /> {this.state.file.name} ({byteSize(this.state.file.size)})
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
            <Modal ref='modal' show={this.props.show} onHide={this.props.onHide} onExited={this.modalExited}>

                <Modal.Header onHide={this.props.onHide} closeButton>
                    Import Viruses
                </Modal.Header>

                <Modal.Body>
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
