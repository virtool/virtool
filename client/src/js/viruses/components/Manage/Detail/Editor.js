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
import { withRouter, Switch, Redirect, Route } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { map, difference, findIndex, find } from "lodash";
import { Row, Col, ListGroup } from "react-bootstrap";

import { formatIsolateName } from "virtool/js/utils";
import { Icon, ListGroupItem } from "virtool/js/components/Base";
import IsolateDetail from "./IsolateDetail";

class IsolateEditor extends React.Component {

    /*

    componentWillReceiveProps = (nextProps) => {
        // In this case the active isolate has been removed (only the active isolate shows a remove icon), the
        // activeIsolateId has to changed before the removal is rendered.
        if (nextProps.data.length > 0 && nextProps.data.length < this.props.data.length) {
            // Find the id of the removed isolate.
            const removedId = difference(
                map(this.props.data, "isolate_id"),
                map(nextProps.data, "isolate_id")
            )[0];

            // Find the index of the remove isolate in the current unupdated set of isolates.
            const removedIndex = findIndex(this.props.data, {isolate_id: removedId});

            // Set state such that the active isolate is the one before the isolate.
            this.selectIsolate(this.props.data[removedIndex - 1].isolate_id);
        }
    };

    componentDidUpdate = (prevProps) => {
        if (prevProps.data !== this.props.data) {
            // A new isolate was added.
            if (this.props.data.length > 0 && this.props.data.length > prevProps.data.length) {
                const lastIsolate = this.props.data[this.props.data.length - 1];
                this.setState({activeIsolateId: lastIsolate.isolate_id});
            }

            // Only one isolate is present.
            if (this.props.data.length === 1) {
                this.setState({activeIsolateId: this.props.data[0].isolate_id});
            }

            // No isolates are associated with the sample.
            if (this.props.data.length === 0) {
                this.setState({activeIsolateId: null});
            }
        }
    };

    */

    render () {

        const activeIsolateId = this.props.match.params.isolateId;

        const isolateComponents = this.props.isolates.map(isolate => {
            const isolateId = isolate.isolate_id;

            return (
                <LinkContainer key={isolateId} to={`/viruses/detail/${this.props.virusId}/virus/${isolateId}`}>
                    <ListGroupItem key={isolate.isolate_id} active={isolateId === activeIsolateId}>
                        {formatIsolateName({sourceType: isolate.source_type, sourceName: isolate.source_name})}
                        {isolate.default ? <Icon name="star" pullRight />: null}
                    </ListGroupItem>
                </LinkContainer>
            );
        });

        // Get the array of sequences from the isolate.
        // const sequenceData = activeIsolate && activeIsolate.hasOwnProperty("sequences") ? activeIsolate.sequences: [];
        return (
            <div>
                <h5>
                    <strong>
                        <Icon name="lab" /> Isolates
                    </strong>
                </h5>
                <Row>
                    <Col md={3}>
                        <ListGroup>
                            {isolateComponents}
                        </ListGroup>
                    </Col>
                    <Col md={9}>
                        <Redirect
                            from="/viruses/detail/:virusId/virus"
                            to={`/viruses/detail/${this.props.virusId}/virus/${this.props.isolates[0].isolate_id}`}
                        />

                        <Route path="/viruses/detail/:virusId/virus/:isolateId" component={IsolateDetail} />
                    </Col>
                </Row>
            </div>
        );
    }

}

const mapStateToProps = (state) => {
    return {
        virusId: state.viruses.detail.virus_id,
        isolates: state.viruses.detail.isolates
    };
};

const Container = withRouter(connect(mapStateToProps)(IsolateEditor));

export default Container;
