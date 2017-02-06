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
import { Alert, FormGroup, InputGroup, FormControl, ListGroup } from "react-bootstrap";
import { Flex, FlexItem, Icon, DetailModal, Button, ListGroupItem } from "virtool/js/components/Base";

import AddHost from "./Hosts/Add";
import HostDetail from "./Hosts/Detail";

/**
 * A component that renders a table of imported hosts and a list of available FASTA files that could be imported as
 * hosts.
 */
export default class SubtractionHosts extends React.Component {

    static propTypes = {
        route: React.PropTypes.object.isRequired
    };

    hideModal = () => {
        dispatcher.router.clearExtra();
    };

    render () {

        let alert;

        if (dispatcher.db.hosts.count({added: true}) === 0) {
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
                                onChange={this.setFindTerm}
                                placeholder="Host name"
                            />
                        </InputGroup>
                    </FormGroup>

                    <Button icon="new-entry" bsStyle="primary" onClick={() => dispatcher.router.setExtra(["add"])}>
                        Create
                    </Button>
                </div>

                <ListGroup>
                    <ListGroupItem key="noSample" className="text-center">
                        <Icon name="info" /> No hosts found
                    </ListGroupItem>
                </ListGroup>

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
