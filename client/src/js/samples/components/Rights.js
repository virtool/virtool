import React from "react";
import PropTypes from "prop-types";
import { Panel } from "react-bootstrap";
import { forEach, capitalize } from "lodash";
import { Input } from "virtool/js/components/Base";

export default class SampleDetailRights extends React.PureComponent {

    static propTypes = {
        id: PropTypes.string,
        group: PropTypes.string,
        group_read: PropTypes.bool,
        group_write: PropTypes.bool,
        all_read: PropTypes.bool,
        all_write: PropTypes.bool
    };

    changeGroup = (event) => {
        dispatcher.db.samples.request("set_group", {
            _id: this.props.id,
            group_id: event.target.value
        });
    };

    changeRights = (event) => {
        let newRights = {};

        forEach({"read": false, "write": false}, (value, key) => {
            newRights[`${event.target.name}_${key}`] = event.target.value.includes(key[0]);
        });

        dispatcher.db.samples.request("set_rights", {
            _id: this.props._id,
            changes: newRights
        });
    };

    render () {

        const rightProps = {
            onChange: this.changeRights,
            type: "select"
        };

        const groupRights = (this.props.group_read ? "r": "") + (this.props.group_write ? "w": "");
        const allRights = (this.props.all_read ? "r": "") + (this.props.all_write ? "w": "");

        const nameOptionComponents = dispatcher.user.groups.map(groupId =>
            <option key={groupId} value={groupId}>{capitalize(groupId)}</option>
        );

        return (
            <Panel className="tab-panel">
                <Input type="select" label="Group" value={this.props.group} onChange={this.changeGroup}>
                    <option value="none">None</option>
                    {nameOptionComponents}
                </Input>

                <Input name="group" {...rightProps} label="Group Rights" value={groupRights}>
                    <option value="">None</option>
                    <option value="r">Read</option>
                    <option value="rw">Read & write</option>
                </Input>

                <Input name="all" {...rightProps} label="All Users' Rights" value={allRights}>
                    <option value="">None</option>
                    <option value="r">Read</option>
                    <option value="rw">Read & write</option>
                </Input>
            </Panel>
        );
    }

}
