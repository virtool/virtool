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
import { capitalize } from "lodash";
import { Row, Col } from "react-bootstrap";
import { Icon, Help, Input } from "virtool/js/components/Base/Icon";

/**
 * A component based on ListGroupItem
 */
export default class PrimaryGroup extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            pending: false
        };
    }

    static propTypes = {
        _id: React.PropTypes.string,
        primaryGroup: React.PropTypes.string,
        groups: React.PropTypes.arrayOf(React.PropTypes.string)
    };

    /**
     * Called when the component is clicked. Selects the component"s user in the parent component.
     */
    handleChange = (event) => {
        this.setState({pending: true}, function () {
            dispatcher.db.users.request("set_primary_group", {
                _id: this.props._id,
                group_id: event.target.value
            });
        });
    };

    render () {

        const groupOptions = this.props.groups.map(groupId =>
            <option key={groupId} value={groupId}>{capitalize(groupId)}</option>
        );

        const inputProps = {
            type: "select",
            value: this.props.primaryGroup,
            onChange: this.handleChange,
            disabled: this.state.pending
        };

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
                        <Input {...inputProps}>
                            <option key="none" value="">None</option>
                            {groupOptions}
                        </Input>
                    </Col>
                </Row>
            </div>
        );
    }
}
