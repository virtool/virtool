/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HMMFiles
 */

import React from "react";
import { sortBy, every, values } from "lodash-es";
import { Row, Col, Modal, Badge, ListGroup, ListGroupItem } from "react-bootstrap";
import { Icon, Flex, Pulse } from "virtool/js/components/Base";
import { byteSize } from "virtool/js/utils";

import HMMErrors from "./Errors";

function getInitialState () {
    return {
        files: null,
        errors: null,
        pressing: false,
        cleaning: false
    };
}

export default class HMMFiles extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        show: React.PropTypes.bool.isRequired,
        onHide: React.PropTypes.func.isRequired
    };

    checkFiles = () => {
        this.setState(getInitialState(), () => {
            dispatcher.db.hmm.request("check_files").success((data) => {
                this.setState({
                    files: data.files,
                    errors: data.errors,
                });
            });
        });
    };

    press = () => {
        this.setState({ pressing: true }, () => {
            dispatcher.db.hmm.request("press").success(() => {
                this.setState({
                    pressing: false,
                    cleaning: false
                }, this.checkFiles);
            });
        });
    };

    clean = () => function () {
        this.setState({ cleaning: true }, () => {
            dispatcher.db.hmm.request("clean", {
                cluster_ids: this.state.errors["not_in_file"]
            }).success(this.checkFiles, this);
        });
    };

    reset = () => {
        this.setState(getInitialState());
    };

    render () {

        let content;

        const hasErrors = !every(values(this.state.errors), function (value) {
            return value === false;
        });

        if (this.state.files || hasErrors) {

            let files;

            if (this.state.files.length > 0) {
                const fileComponents = sortBy(this.state.files, "_id").map((file, index) => (
                    <ListGroupItem key={index}>
                        <Row>
                            <Col md={6}>
                                <Icon name="file" /> {file._id}
                            </Col>
                            <Col md={6}>
                                {byteSize(file.size)} />
                            </Col>
                        </Row>
                    </ListGroupItem>
                ));

                files = (
                    <div>
                        <ListGroup>
                            {fileComponents}
                        </ListGroup>
                    </div>
                );
            }

            const errors = hasErrors ? (
                <HMMErrors
                    {...this.state}
                    clean={this.clean}
                    press={this.press}
                    checkFiles={this.checkFiles}
                />
            ): null;

            content = (
                <div>
                    {files}
                    {errors}
                </div>
            );
        } else {
            content = (
                <Flex justifyContent="center">
                    <Flex.Item>
                        <Pulse color="#337ab7" size="50px" />
                    </Flex.Item>
                </Flex>
            );
        }

        return (
            <Modal show={this.props.show} onHide={this.props.onHide} onEntered={this.checkFiles} onExited={this.reset}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    HMM Files {this.state.files ? <Badge>{this.state.files.length}</Badge>: null}
                </Modal.Header>
                <Modal.Body>
                    {content}
                </Modal.Body>
            </Modal>
        );
    }
}
