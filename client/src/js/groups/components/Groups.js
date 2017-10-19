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
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Modal } from "react-bootstrap";

import { listGroups } from "../actions";

/**
 * Renders either a table describing the sessions associated with the user or a panel with a message indicating no
 * sessions are associated with that user.
 *
 * @class
 */
class Groups extends React.Component {

    constructor (props) {
        super(props);
    }

    static propTypes = {
        show: PropTypes.bool,
        onHide: PropTypes.func
    };

    componentWillMount () {
        this.props.onList();
    }

    select = (groupId) => {
        this.setState({activeId: groupId});
    };

    render () {

        /*

        const groupItemComponents = this.state.documents.map((document) => {

            let removeIcon;

            if (document._id !== "limited" && document._id !== "administrator") {
                removeIcon = <Icon name="remove" className="pull-right" onClick={() => this.remove(document._id)} />;
            }

            return (
                <ListGroupItem
                    key={document._id}
                    active={this.state.activeId == document._id}
                    onClick={() => this.select(document._id)}
                >
                    {capitalize(document._id)}
                    {removeIcon}
                </ListGroupItem>
            );

        });

        const activeGroup = find(this.state.documents, {_id: this.state.activeId});

        */

        return (
            <Modal show={this.props.show} onHide={this.props.onHide}>
                <Modal.Header>
                    Manage Groups
                </Modal.Header>
                <Modal.Body>
                    Test
                    {/*
                    <Row>
                        <Col md={6}>
                            <FlipMove {...getFlipMoveProps()}>
                                <Add collection={dispatcher.db.groups} />
                                {groupItemComponents}
                            </FlipMove>
                        </Col>
                        <Col md={6}>
                            <FlipMove enterAnimation="fade" leaveAnimation={false} duration={180}>
                                <Permissions
                                    key={activeGroup._id}
                                    groupName={activeGroup._id}
                                    permissions={activeGroup.permissions}
                                    collection={dispatcher.db.groups}
                                />
                            </FlipMove>
                        </Col>
                    </Row>
                    */}
                </Modal.Body>
            </Modal>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        groups: state.groups.list
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onList: () => {
            dispatch(listGroups());
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(Groups);

export default Container;
