var _ = require('lodash');
var React = require('react');
var Panel = require('react-bootstrap/lib/Panel');

var Input = require('virtool/js/components/Base/Input.jsx');

var SampleDetailRights = React.createClass({

    changeGroup: function (event) {
        dispatcher.db.samples.request('set_group', {
            _id: this.props._id,
            group_id: event.target.value
        });
    },

    changeRights: function (event) {
        var newRights = {};

        _.forEach({'read': false, 'write': false}, function (value, key) {
            newRights[event.target.name + '_' + key] = event.target.value.includes(key[0]);
        });

        dispatcher.db.samples.request('set_rights', {
            _id: this.props._id,
            changes: newRights
        });
    },

    render: function () {
        var rightProps = {
            onChange: this.changeRights,
            type: 'select'
        };

        var groupRights = (this.props.group_read ? 'r': '') + (this.props.group_write ? 'w': '');
        var allRights = (this.props.all_read ? 'r': '') + (this.props.all_write ? 'w': '');

        var nameOptionComponents = dispatcher.user.groups.map(function (groupId) {
            return <option key={groupId} value={groupId}>{_.capitalize(groupId)}</option>
        });

        return (
            <Panel className='tab-panel'>
                <Input type='select' label='Group' value={this.props.group} onChange={this.changeGroup}>
                    <option value='none'>None</option>
                    {nameOptionComponents}
                </Input>

                <Input name='group' {...rightProps} label='Group Rights' value={groupRights}>
                    <option value=''>None</option>
                    <option value='r'>Read</option>
                    <option value='rw'>Read & write</option>
                </Input>

                <Input name='all' {...rightProps} label="All Users' Rights" value={allRights}>
                    <option value=''>None</option>
                    <option value='r'>Read</option>
                    <option value='rw'>Read & write</option>
                </Input>
            </Panel>
        );
    }

});

module.exports = SampleDetailRights;