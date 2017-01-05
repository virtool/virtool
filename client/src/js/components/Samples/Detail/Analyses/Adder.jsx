"use strict";

var _ = require("lodash");
var React = require("react");
var Flex = require("virtool/js/components/Base/Flex.jsx");
var Icon = require("virtool/js/components/Base/Icon.jsx");
var Input = require("virtool/js/components/Base/Input.jsx");
var Button = require("virtool/js/components/Base/PushButton.jsx");

var AnalysisAdder = React.createClass({

    propTypes: {
        sampleId: React.PropTypes.string.isRequired,
        setProgress: React.PropTypes.func
    },

    getInitialState: function () {
        return {
            name: "",
            algorithm: "pathoscope_bowtie",
            pending: false
        }
    },

    shouldComponentUpdate: function (nextProps, nextState) {
        return !_.isEqual(this.state, nextState);
    },

    handleChange: function (event) {
        var data = {};
        data[event.target.name] = event.target.value;
        this.setState(data);
    },

    handleSubmit: function (event) {
        event.preventDefault();

        this.props.setProgress(true);

        dispatcher.db.samples.request("analyze", {
            samples: [this.props.sampleId],
            algorithm: this.state.algorithm,
            name: this.state.name || null
        })
        .success(function () {
            this.props.setProgress(false);
            this.setState(this.getInitialState());
        }, this)
        .failure(function () {
            this.props.setProgress(false);
            this.setState(this.getInitialState());
        }, this);
    },

    render: function () {
        return (
            <form onSubmit={this.handleSubmit}>
                <Flex alignItems="flex-end">
                    <Flex.Item grow={5}>
                        <Input
                            name="nickname"
                            label="Name"
                            value={this.state.nickname}
                            onChange={this.handleChange}
                            disabled={true}
                        />
                    </Flex.Item>
                    <Flex.Item grow={1} pad>
                        <Input name="algorithm" type="select" label="Algorithm" value={this.state.algorithm}
                               onChange={this.handleChange}>
                            <option value="pathoscope_bowtie">PathoscopeBowtie</option>
                            <option value="pathoscope_snap">PathoscopeSNAP</option>
                            <option value="nuvs">NuVs</option>
                        </Input>
                    </Flex.Item>
                    <Flex.Item pad>
                        <Button type="submit" style={{marginBottom: "15px"}} bsStyle="primary">
                            <Icon name="new-entry" pending={this.state.pending}/> Create
                        </Button>
                    </Flex.Item>
                </Flex>
            </form>
        );
    }
});

module.exports = AnalysisAdder;