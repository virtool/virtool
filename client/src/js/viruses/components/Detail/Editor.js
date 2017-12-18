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

import React from "react";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { Badge, Row, Col, ListGroup } from "react-bootstrap";

import { formatIsolateName } from "../../../utils";
import { selectIsolate, showAddIsolate } from "../../actions";
import { FlexItem, Icon, ListGroupItem, NoneFound } from "../../../base";
import IsolateDetail from "./IsolateDetail";

const IsolateEditor = (props) => {

    const isolateComponents = props.isolates.map(isolate =>
        <ListGroupItem
            key={isolate.id}
            className="isolate-item"
            active={isolate.id === props.activeIsolateId}
            onClick={() => props.onSelectIsolate(isolate.id)}
        >
            <div className="isolate-item-name">
                <span>{formatIsolateName(isolate)}</span>
            </div>
            <div className="isolate-item-icon">
                <span>{isolate.default ? <Icon className="pull-right" name="star" /> : null}</span>
            </div>
        </ListGroupItem>
    );

    let noIsolatesFound;

    if (!isolateComponents.length) {
        noIsolatesFound = (
            <Col md={12}>
                <NoneFound noun="isolates" />
            </Col>
        );
    }

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

                {props.canModify ? (
                    <Icon
                        bsStyle="primary"
                        name="new-entry"
                        tip="Add Isolate"
                        style={{fontSize: "15px"}}
                        onClick={props.showAddIsolate}
                    />
                ) : null}
            </h4>

            <Row>
                {noIsolatesFound}
                <Col md={3}>
                    <ListGroup style={{height: "100%"}} fill>
                        {isolateComponents}
                    </ListGroup>
                </Col>
                <Col md={9}>
                    {noIsolatesFound ? null : <IsolateDetail />}
                </Col>
            </Row>
        </div>
    );
};

const mapStateToProps = state => ({
    virusId: state.viruses.detail.id,
    isolates: state.viruses.detail.isolates,
    activeIsolateId: state.viruses.activeIsolateId,
    canModify: state.account.permissions.modify_virus
});

const mapDispatchToProps = dispatch => ({

    onSelectIsolate: isolateId => {
        dispatch(selectIsolate(isolateId));
    },

    showAddIsolate: () => {
        dispatch(showAddIsolate());
    }

});

const Container = withRouter(connect(mapStateToProps, mapDispatchToProps)(IsolateEditor));

export default Container;
