/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports PrimaryGroup
 */

import React from "react";
import { connect } from "react-redux";
import { find, capitalize } from "lodash";
import { Row, Col } from "react-bootstrap";

import { setPrimaryGroup } from "../actions";
import { Icon, Help, Input } from "virtool/js/components/Base";

/**
 * A component based on ListGroupItem
 */
const PrimaryGroup = (props) => {

    const groupOptions = props.groups.map(groupId =>
        <option key={groupId} value={groupId}>{capitalize(groupId)}</option>
    );

    return (
        <div>
            <Row>
                <Col md={12}>
                    <h5>
                        <Icon name="checkmark" /> <strong>Primary Group</strong>
                        <Help pullRight>
                            This group will be assigned to any samples created by the user.
                        </Help>
                    </h5>
                </Col>
            </Row>
            <Row>
                <Col md={12}>
                    <Input
                        type="select"
                        value={props.primaryGroup}
                        onChange={(e) => props.onChange(props.userId, e.target.value)}
                    >
                        <option key="none" value="none">None</option>
                        {groupOptions}
                    </Input>
                </Col>
            </Row>
        </div>
    );
};

PrimaryGroup.propTypes = {
    userId: React.PropTypes.string,
    primaryGroup: React.PropTypes.string,
    groups: React.PropTypes.arrayOf(React.PropTypes.string),
    onChange: React.PropTypes.func
};

const mapStateToProps = (state) => {
    const activeData = find(state.users.list, {user_id: state.users.activeId});

    return {
        userId: activeData.user_id,
        primaryGroup: activeData.primary_group,
        groups: activeData.groups
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onChange: (userId, groupId) => {
            dispatch(setPrimaryGroup(userId, groupId));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(PrimaryGroup);

export default Container;
