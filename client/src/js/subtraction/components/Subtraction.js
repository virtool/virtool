/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ManageHosts
 */

import React, { PropTypes } from "react";
import { connect } from "react-redux";
import { Row, Col, Alert, FormGroup, InputGroup, FormControl } from "react-bootstrap";

import { findSubtractions } from "../actions";
import { Flex, FlexItem, Icon, Button, ListGroupItem } from "virtool/js/components/Base";



class SubtractionHosts extends React.Component {

    static propTypes = {
        documents: PropTypes.arrayOf(PropTypes.object)
    };

    componentDidMount () {
        this.props.onFind()
    }

    render () {

        if (this.props.documents === null) {
            return <div />;
        }

        let alert;

        if (!this.props.readyCount) {
            alert = (
                <Alert>
                    <Flex alignItems="center">
                        <Icon name="notification" />
                        <FlexItem pad={5}>
                            A host genome must be added to Virtool before samples can be created and analyzed.
                        </FlexItem>
                    </Flex>
                </Alert>
            );
        }

        let hostComponents = this.props.documents.map((host) => {

            let statusComponent = "Adding";

            if (host.ready) {
                statusComponent = (
                    <Flex alignItems="center" className="pull-right">
                        <Icon name="checkmark" bsStyle="success" />
                        <FlexItem pad>
                            <strong>Ready</strong>
                        </FlexItem>
                    </Flex>
                )
            }

            return (
                <ListGroupItem key={host.host_id} className="spaced">
                    <Row>
                        <Col md={4}>
                            <strong>{host.host_id}</strong>
                        </Col>
                        <Col md={3} className="text-muted">
                            {host.description}
                        </Col>
                        <Col md={5}>
                            {statusComponent}
                        </Col>
                    </Row>
                </ListGroupItem>
            );
        });

        if (!hostComponents.length) {
            hostComponents = (
                <ListGroupItem key="noSample" className="text-center">
                    <Icon name="info" /> No hosts found
                </ListGroupItem>
            );
        }

        return (
            <div>
                {alert}

                <div key="toolbar" className="toolbar">
                    <FormGroup>
                        <InputGroup>
                            <InputGroup.Addon>
                                <Icon name="search" /> Find
                            </InputGroup.Addon>
                            <FormControl
                                type="text"
                                onChange={(event) => console.log(event.target.value)}
                                placeholder="Host name"
                            />
                        </InputGroup>
                    </FormGroup>

                    <Button icon="new-entry" bsStyle="primary" onClick={() => window.router.setExtra(["add"])}>
                        Create
                    </Button>
                </div>

                <div className="list-group">
                    {hostComponents}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        documents: state.subtraction.documents,
        readyHostCount: state.subtraction.readyHostCount
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onFind: () => {
            dispatch(findSubtractions())
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(SubtractionHosts);

export default Container;
