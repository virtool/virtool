var _ = require('lodash');
var React = require("react");
var Alert = require('react-bootstrap/lib/Alert');
var Modal = require('react-bootstrap/lib/Modal');
var Button = require('react-bootstrap/lib/Button');
var Tab = require('react-bootstrap/lib/Tab');
var Tabs = require('react-bootstrap/lib/Tabs');

var General = require("./general/panel.jsx");
var Quality = require("./Quality/Quality.jsx");
var Analysis = require("./analysis/Panel.jsx");
var Rights = require("./Rights/Panel.jsx");

var Icon = require("virtool/js/components/Base/Icon.jsx");
var ConfirmFooter = require("virtool/js/components/Base/ConfirmFooter.jsx");

var SampleDetail = React.createClass({

    getInitialState: function () {
        return {
            activeKey: 1
        };
    },

    handleSelect: function (eventKey) {
        this.setState({activeKey: eventKey});
    },

    remove: function () {
        dispatcher.collections.samples.request('remove_sample', {_id: this.props.detail._id});
    },

    render: function () {

        var data = this.props.detail;
        
        var body;
        var footer;

        if (data.imported === true) {

            var isOwner = dispatcher.user.name === data.username;

            var canModify = (
                data.all_write ||
                (data.group_write && dispatcher.user.groups.indexOf(data.group) > -1) ||
                isOwner
            );

            var buttonContent = (
                <span>
                    <Icon name='remove'/> Remove
                </span>
            );

            var tabContentProps = _.assign({
                data: data,
                canModify: canModify,
                activeKey: this.state.activeKey
            }, this.props);

            var rightsTab;

            if (isOwner || dispatcher.user.groups.indexOf('administrator') > -1) {
                rightsTab = (
                    <Tab eventKey={4} title={<Icon name='key' />}>
                        <Rights {...tabContentProps} />
                    </Tab>
                );
            }

            if (canModify) {
                footer = (
                    <ConfirmFooter
                        onHide={this.props.onHide}
                        buttonContent={buttonContent}
                        callback={this.remove}
                        message='Are you sure you want to delete this sample?'
                    />
                );
            }

            body = (
                <Tabs ref='tabs' activeKey={this.state.activeKey} animation={false} onSelect={this.handleSelect}>
                    <Tab eventKey={1} title='General'>
                        <General {...tabContentProps} />
                    </Tab>
                    <Tab eventKey={2} title='Quality'>
                        <Quality {...tabContentProps} />
                    </Tab>
                    <Tab eventKey={3} title='Analysis'>
                        <Analysis {...tabContentProps} />
                    </Tab>

                    {rightsTab}
                </Tabs>
            );
        } else {
            body = (
                <div className='text-center'>
                    <p>Sample is being imported...</p>
                    <p><Icon name='spinner' pending={true} /></p>
                </div>
            );
        }

        return (
            <div>
                <Modal.Header>
                    {this.props.detail.name}
                </Modal.Header>

                <Modal.Body {...this.props}>
                    {body}
                </Modal.Body>

                {footer}
            </div>
        )
    }
});

module.exports = SampleDetail;