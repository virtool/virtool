var React = require('react');
var SampleController = require("./Manage/Controller.jsx");

var ManageSamples = React.createClass({

    propTypes: {
        route: React.PropTypes.object
    },

    getInitialState: function () {
        return {
            documents: dispatcher.db.samples.chain()
        };
    },

    componentDidMount: function () {
        dispatcher.db.samples.on("change", this.update);
    },

    componentWillUnmount: function () {
        dispatcher.db.samples.off("change", this.update);
    },

    update: function () {
        this.setState(this.getInitialState());
    },

    render: function () {
        return (
            <SampleController
                route={this.props.route}
                documents={this.state.documents}
            />
        );
    }

});

module.exports = ManageSamples;
