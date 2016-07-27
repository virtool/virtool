var _ = require("lodash");
var React = require('react');
var LinkedStateMixin = require('react-addons-linked-state-mixin');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Alert = require('react-bootstrap/lib/Alert');
var Badge = require('react-bootstrap/lib/Badge');
var Input = require('react-bootstrap/lib/Input');
var Button = require('react-bootstrap/lib/Button');
var ListGroup =require('react-bootstrap/lib/ListGroup');
var ListGroupItem =require('react-bootstrap/lib/ListGroupItem');

var InputError = require('virtool/js/components/Base/InputError.jsx');

var ImportForm = React.createClass({

    mixins: [LinkedStateMixin],

    getInitialState: function () {

        var readyHosts = _.filter(dispatcher.db.hosts.documents, {added: true});

        return {
            name: '',
            host: '',
            isolate: '',
            locale: '',
            paired: false,
            group: dispatcher.settings.get('sample_group') == 'force_choice' ? 'none': '',
            subtraction: readyHosts.length > 0 ? readyHosts[0]._id: null,
            forceGroupChoice: this.getForceGroupChoice()
        }
    },

    componentDidMount: function () {
        this.refs.name.getInputDOMNode().focus();
        dispatcher.settings.on('change', this.onSettingsChange);
    },

    componentWillUnmount: function () {
        dispatcher.settings.off('change', this.onSettingsChange);
    },

    onSettingsChange: function () {
        this.setState({forceGroupChoice: this.getForceGroupChoice()});
    },

    getForceGroupChoice: function () {
        return dispatcher.settings.get('sample_group') == 'force_choice'
    },

    getValues: function () {
        return _.omit(this.state, 'forceGroupChoice');
    },

    clear: function () {
        this.setState(this.getInitialState());
    },

    render: function () {


        var hostComponents = _.filter(dispatcher.db.hosts.documents, {"added": true}).map(function (host) {
            return <option key={host._id}>{host._id}</option>;
        });

        var userGroup;

        if (this.state.forceGroupChoice) {
            var userGroupComponents = dispatcher.user.groups.map(function (groupId) {
                return <option key={groupId} value={groupId}>{_.capitalize(groupId)}</option>
            });

            userGroup = (
                <Col md={3}>
                    <Input type='select' label='User Group' valueLink={this.linkState('group')}>
                        <option key='none' value='none'>None</option>
                        {userGroupComponents}
                    </Input>
                </Col>
            );
        }

        var error;

        if (this.props.nameExistsError) {
            error = 'Sample name already exists. Choose another.'
        }

        if (this.props.nameEmptyError) {
            error = 'The name field cannot be empty.'
        }

        return (
            <div>
                <Row>
                    <Col md={9}>
                        <InputError
                            ref='name'
                            type='text'
                            error={error ? <span className='text-danger'>{error}</span>: null}
                            valueLink={this.linkState('name')}
                            label='Sample Name'
                            autoComplete='off'
                        />
                    </Col>
                    <Col md={3}>
                        <Input type='text' label='Isolate' valueLink={this.linkState('isolate')} />
                    </Col>
                </Row>

                <Row>
                    <Col md={6}>
                        <Input type='text' label='True Host' valueLink={this.linkState('host')} />
                    </Col>
                    <Col md={6}>
                        <Input type='select' label='Subtraction Host' valueLink={this.linkState('subtraction')}>
                            {hostComponents}
                        </Input>
                    </Col>
                </Row>

                <Row>
                    <Col md={this.state.forceGroupChoice ? 6: 8}>
                        <Input type='text' label='Locale' valueLink={this.linkState('locale')} />
                    </Col>
                    {userGroup}
                    <Col md={this.state.forceGroupChoice ? 3: 4}>
                        <Input type='select' label='Library Type' valueLink={this.linkState('paired')}>
                            <option value={false}>Unpaired</option>
                            <option value={true}>Paired</option>
                        </Input>
                    </Col>
                </Row>
            </div>
        );
    }

});

module.exports = ImportForm;