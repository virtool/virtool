var React = require('react');
var ReactDOM = require('react-dom');
var FlipMove = require('react-flip-move');
var FormGroup = require('react-bootstrap/lib/FormGroup');
var InputGroup = require('react-bootstrap/lib/InputGroup');
var FormControl = require('react-bootstrap/lib/FormControl');
var ButtonGroup = require('react-bootstrap/lib/ButtonGroup');

var SampleList = require("./List.jsx");

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

var SampleController = React.createClass({

    propTypes: {
        route: React.PropTypes.object,
        documents: React.PropTypes.object
    },

    getInitialState: function () {
        return {
            findTerm: "",
            archived: false,

            canCreate: dispatcher.user.permissions.add_sample
        };
    },

    componentDidMount: function () {
        dispatcher.user.on('change', this.onUserChange);

        ReactDOM.findDOMNode(this.refs.name).focus();
    },

    componentWillUnmount: function () {
        dispatcher.user.off('change', this.onUserChange);
    },

    setFindTerm: function (event) {
        this.setState({
            findTerm: event.target.value
        });
    },

    toggleArchived: function (event) {
        this.setState({
            archived: !this.state.archived
        });
    },

    create: function () {
        dispatcher.router.setExtra(["create"]);
    },

    onUserChange: function () {
        this.setState({
            canCreate: dispatcher.user.permissions.add_sample
        });
    },

    render: function () {

        var documents = this.props.documents.branch().find({
            archived: this.state.archived
        });

        if (this.state.findTerm) {
            var test = {$regex: [this.state.findTerm, "i"]};

            documents = documents.find({
                $or: [
                    {name: test},
                    {username: test}
                ]
            });
        }

        var createButton = this.state.canCreate ? (
            <Flex.Item shrink={0} pad>
                <PushButton bsStyle='primary' tip="Create sample" onClick={this.show}>
                    <Icon name='new-entry' /> Create
                </PushButton>
            </Flex.Item>
        ): null;

        return (
            <FlipMove typeName="div">
                <Flex>
                    <Flex.Item grow={1}>
                        <FormGroup>
                            <InputGroup>
                                <InputGroup.Addon>
                                    <Icon name='search' /> Find
                                </InputGroup.Addon>
                                <FormControl
                                    type='text'
                                    ref='name'
                                    onChange={this.setFindTerm}
                                    placeholder='Sample name'
                                />
                            </InputGroup>
                        </FormGroup>
                    </Flex.Item>
                    <Flex.Item shrink={0} pad>
                        <ButtonGroup>
                            <PushButton active={!this.state.archived} onClick={this.state.archived ? this.toggleArchived: null} tip="Active Samples">
                                <Icon name="play" />
                            </PushButton>
                            <PushButton active={this.state.archived} onClick={this.state.archived ? null: this.toggleArchived} tip="Archived Samples">
                                <Icon name="box-add" />
                            </PushButton>
                        </ButtonGroup>
                    </Flex.Item>
                    {createButton}
                </Flex>

                <SampleList
                    route={this.props.route}
                    documents={documents}
                    archived={this.props.archived}
                />
            </FlipMove>
        );
    }
});

module.exports = SampleController;
