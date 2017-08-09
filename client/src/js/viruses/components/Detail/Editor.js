/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * exports Isolates
 */

import React, { PropTypes } from "react";
import { connect } from "react-redux";
import { withRouter, Redirect, Route } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Badge, Row, Col, ListGroup } from "react-bootstrap";

import { formatIsolateName } from "virtool/js/utils";
import { showAddIsolate } from "../../actions";
import { FlexItem, Icon, ListGroupItem } from "virtool/js/components/Base";
import IsolateDetail from "./IsolateDetail";

const IsolateEditor = (props) => {

    const activeIsolateId = props.match.params.isolateId;

    const isolateComponents = props.isolates.map(isolate =>
        <LinkContainer key={isolate.id} to={`/viruses/${props.virusId}/virus/${isolate.id}`}>
            <ListGroupItem key={isolate.id} active={isolate.id === activeIsolateId}>
                {formatIsolateName(isolate)}
                {isolate.default ? <Icon name="star" pullRight />: null}
            </ListGroupItem>
        </LinkContainer>
    );

    let noIsolatesFound;

    if (!isolateComponents.length) {
        noIsolatesFound = (
            <Col md={12}>
                <ListGroupItem className="text-center">
                    <Icon name="info" /> No isolates found
                </ListGroupItem>
            </Col>
        );
    }

    let firstIsolateId = props.isolates[0] ? props.isolates[0].id: "";

    if (firstIsolateId) {
        firstIsolateId = "/" + firstIsolateId;
    }

    // Get the array of sequences from the isolate.
    // const sequenceData = activeIsolate && activeIsolate.hasOwnProperty("sequences") ? activeIsolate.sequences: [];
    return (
        <div>
            <h4 style={{display: "flex", alignItems: "center"}} className="section-header">
                <FlexItem grow={0} shrink={0}>
                    <strong>
                        Isolates
                    </strong>
                </FlexItem>

                <FlexItem grow={1} pad={5}>
                    <Badge>
                        {isolateComponents.length}
                    </Badge>
                </FlexItem>

                <Icon bsStyle="primary" name="new-entry" tip="Add Isolate" onClick={props.showAddIsolate} />
            </h4>

            <Row>
                {noIsolatesFound}
                <Col md={3}>
                    <ListGroup style={{height: "100%"}} fill>
                        {isolateComponents}
                    </ListGroup>
                </Col>
                <Col md={9}>
                    <Redirect
                        from="/viruses/:virusId/virus"
                        to={`/viruses/${props.virusId}/virus${firstIsolateId}`}
                    />
                    <Route path="/viruses/:virusId/virus/:isolateId" component={IsolateDetail} />
                </Col>
            </Row>
        </div>
    );
};

IsolateEditor.propTypes = {
    match: PropTypes.object,
    virusId: PropTypes.string,
    isolates: PropTypes.arrayOf(PropTypes.object),
    showAddIsolate: PropTypes.func
};

const mapStateToProps = (state) => {
    return {
        virusId: state.viruses.detail.id,
        isolates: state.viruses.detail.isolates
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        showAddIsolate: () => {
            dispatch(showAddIsolate());
        }
    };
};

const Container = withRouter(connect(mapStateToProps, mapDispatchToProps)(IsolateEditor));

export default Container;
