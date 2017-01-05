/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Groups
 */

import React from "react";
import FlipMove from "react-flip-move"
import { capitalize, find } from "lodash-es";
import { Row, Col } from "react-bootstrap";
import { Modal, Icon, ListGroupItem } from "virtool/js/components/Base";

import Add from "./Add";
import Permissions from "./Permissions";

const getState = () => {
    const documents = this.getEntries();

    return {
        documents: documents,
        activeId: documents[0]._id
    };
};

/**
 * Renders either a table describing the sessions associated with the user or a panel with a message indicating no
 * sessions are associated with that user.
 *
 * @class
 */
export default class Groups extends React.Component {

    constructor (props) {
        super(props);
        this.state = getState();
    }

    static propTypes = {
        show: React.PropTypes.bool,
        onHide: React.PropTypes.func
    };

    componentDidMount () {
        dispatcher.db.groups.on("change", this.update);
    }

    componentWillUnmount () {
        dispatcher.db.groups.off("change", this.update);
    }

    getEntries = () => dispatcher.db.groups.chain().find().simplesort("_id").data();

    select = (groupId) => {
        this.setState({activeId: groupId});
    };

    update = () => {
        this.setState(getState());
    };

    remove = (groupName) => {
        dispatcher.db.groups.request("remove_group", {
            _id: groupName
        });
    };

    render () {

        const groupItemComponents = this.state.documents.map((document) => {
            const props = {
                key: document._id,
                active: this.state.activeId == document._id,
                onClick: function () {this.select(document._id)}.bind(this)
            };

            let removeIcon;

            if (document._id !== "limited" && document._id !== "administrator") {
                removeIcon = <Icon name="remove" className="pull-right" onClick={() => this.remove(document._id)} />;
            }

            return (
                <ListGroupItem {...props}>
                    {capitalize(document._id)}
                    {removeIcon}
                </ListGroupItem>
            );

        });

        const activeGroup = find(this.state.documents, {_id: this.state.activeId});

        return (
            <Modal dialogClassName="modal-md" show={this.props.show} onHide={this.props.onHide}>
                <Modal.Header>
                    User Groups
                </Modal.Header>
                <Modal.Body>
                    <Row>
                        <Col md={6}>
                            <FlipMove>
                                <Add collection={dispatcher.db.groups} />
                                {groupItemComponents}
                            </FlipMove>
                        </Col>
                        <Col md={6}>
                            <FlipMove leaveAnimation={false} duration={200}>
                                <Permissions
                                    key={activeGroup._id}
                                    groupName={activeGroup._id}
                                    permissions={activeGroup.permissions}
                                    collection={dispatcher.db.groups}
                                />
                            </FlipMove>
                        </Col>
                    </Row>
                </Modal.Body>
            </Modal>
        );
    }
}
