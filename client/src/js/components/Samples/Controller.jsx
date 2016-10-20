var React = require('react');
var SampleList = require("./List.jsx");

var SampleController = React.createClass({

    propTypes: {
        route: React.PropTypes.object,
        archived: React.PropTypes.bool
    },

    getInitialState: function () {
        return {
            documents: dispatcher.db.samples.chain().find({archived: this.props.archived})
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
            <SampleList
                route={this.props.route}
                documents={this.state.documents}
                archived={this.props.archived}
            />
        );
    }
});

module.exports = SampleController;
