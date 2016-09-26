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

'use strict';

var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Help = require('virtool/js/components/Base/Help.jsx');
var Input = require('virtool/js/components/Base/Input.jsx');

/**
 * A component based on ListGroupItem
 */
var PrimaryGroup = React.createClass({

    getInitialState: function () {
        return {
            pending: false
        };
    },

    /**
     * Called when the component is clicked. Selects the component's user in the parent component.
     */
    handleChange: function (event) {
        var groupId = event.target.value;

        this.setState({pending: true}, function () {
            dispatcher.db.users.request('set_primary_group', {
                _id: this.props._id,
                group_id: groupId
            }).success(this.onComplete).failure(this.onComplete);
        });
    },

    render: function () {

        var groupOptions = this.props.groups.map(function (groupId) {
            return <option key={groupId} value={groupId}>{_.capitalize(groupId)}</option>;
        });

        var inputProps = {
            type: 'select',
            value: this.props.primary_group,
            onChange: this.handleChange,
            disabled: this.state.pending
        };

        return (
            <div>
                <Row>
                    <Col md={12}>
                        <h5>
                            <Icon name='checkmark' /> <strong>Primary Group</strong>
                            <Help pullRight>
                                This group will be assigned to any samples created by the user.
                            </Help>
                        </h5>
                    </Col>
                </Row>
                <Row>
                    <Col md={12}>
                        <Input {...inputProps}>
                            <option key='none' value=''>None</option>
                            {groupOptions}
                        </Input>
                    </Col>
                </Row>
            </div>
        );
    }
});

module.exports = PrimaryGroup;

