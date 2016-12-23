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
import { Row, Col, Modal, Alert, Panel } from 'react-bootstrap';
import { Icon, Button} from "virtool/js/components/Base";
import { byteSize } from "virtool/js/utils";

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
            warnings: null,
            response: null
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
        dispatcher.db.viruses.request('import_data', {file_id: this.state.fileId})
            .success(function (data) {
                this.setState(_.extend(this.getInitialState(), {response: data}));
            }, this)
            .failure(function () {
                this.setState({warnings: data});
            }, this);
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

        if (this.state.warnings) {
            var warnings = _.mapValues(this.state.warnings, function (items, warning) {
                if (items.length === 0) return null;

                var itemComponents = items.map(function (item, index) {
                    return <li key={index}>{item}</li>
                });

                return (
                    <div>
                        <h5>The following {warning}s already exist in the database:</h5>
                        <ul>
                            {itemComponents}
                        </ul>
                    </div>
                );
            }.bind(this));

            var footer = (
                <div className='clearfix'>
                    <Button onClick={this.props.onHide} className='pull-right'>
                        <Icon name='checkmark' /> Accept
                    </Button>
                </div>
            );

            content = (
                <div className='clearfix'>
                    <Panel bsStyle='danger' header='Error' footer={footer}>
                        {warnings.name}
                        {warnings.abbreviation}
                    </Panel>
                </div>
            );
        } else if (this.state.response) {
            content = (
                <Alert bsStyle='success'>
                    <Row>
                        <Col md={9}>
                            Added {this.state.response.viruses} viruses and {this.state.response.isolates} isolates.
                        </Col>
                        <Col md={3}>
                            <Button className='pull-right' onClick={this.hide}>
                                <Icon name='checkmark' /> Accept
                            </Button>
                        </Col>
                    </Row>
                </Alert>
            );

        } else {
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
        }

        return (
            <Modal show={this.props.show} onHide={this.props.onHide} onExited={this.modalExited} >
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Import Viruses
                </Modal.Header>

                <Modal.Body>
                    <Panel>
                        Import viruses from a JSON or gzip-compressed JSON file generated by Virtool. The file will be
                        scanned for duplicate sequence accessions and virus names. All imported records will be
                        assigned new unique IDs and will not be compatible with the originating Virtool instance.
                    </Panel>

                    {content}
                </Modal.Body>
            </Modal>
        );



    }
});

module.exports = ImportViruses;
