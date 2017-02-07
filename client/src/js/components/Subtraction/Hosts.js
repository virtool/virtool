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

import React from "react";
import FlipMove from "react-flip-move";
import { Row, Col, Alert, FormGroup, InputGroup, FormControl } from "react-bootstrap";
import { Flex, FlexItem, Icon, DetailModal, Button, ListGroupItem, getFlipMoveProps } from "virtool/js/components/Base";

import AddHost from "./Hosts/Add";
import HostDetail from "./Hosts/Detail";

const getHosts = () => dispatcher.db.hosts.chain();

/**
 * A component that renders a table of imported hosts and a list of available FASTA files that could be imported as
 * hosts.
 */
export default class SubtractionHosts extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            hosts: getHosts(),
            findTerm: ""
        };
    }

    static propTypes = {
        route: React.PropTypes.object.isRequired
    };

    componentDidMount () {
        dispatcher.db.hosts.on("change", this.update);
    }

    componentWillUnmount () {
        dispatcher.db.hosts.off("change", this.update);
    }

    hideModal = () => {
        dispatcher.router.clearExtra();
    };

    update = () => {
        this.setState({
            hosts: getHosts()
        });
    };

    render () {

        let alert;

        if (dispatcher.db.hosts.count({ready: true}) === 0) {
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

        let detailTarget;

        if (this.props.route.extra[0] === "detail") {
            detailTarget = dispatcher.db.hosts.findOne({_id: this.props.route.extra[1]});
        }

        let query = {};

        if (this.state.findTerm) {
            query["_id"] = {$regex: [this.state.findTerm, "i"]};
        }

        let hostComponents = this.state.hosts.branch().find(query).data().map((host) => {

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
                <ListGroupItem
                    key={host._id}
                    className="spaced"
                    onClick={() => dispatcher.router.setExtra(["detail", host._id])}
                >
                    <Row>
                        <Col md={4}>
                            <strong>{host._id}</strong>
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

        if (hostComponents.length === 0) {
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
                                inputRef={(node) => this.nameNode = node}
                                onChange={(event) => this.setState({findTerm: event.target.value})}
                                placeholder="Host name"
                            />
                        </InputGroup>
                    </FormGroup>

                    <Button icon="new-entry" bsStyle="primary" onClick={() => dispatcher.router.setExtra(["add"])}>
                        Create
                    </Button>
                </div>

                <FlipMove {...getFlipMoveProps}>
                    {hostComponents}
                </FlipMove>

                <AddHost show={this.props.route.extra[0] === "add"} onHide={this.hideModal} />

                <DetailModal
                    target={detailTarget}
                    contentComponent={HostDetail}
                    collection={dispatcher.db.hosts}
                    onHide={this.hideModal}
                    dialogClassName="modal-md"
                />
            </div>
        );
    }
}
