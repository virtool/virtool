var React = require('react');
var SampleController = require("./Controller.jsx");

var ArchivedSamples = React.createClass({

    render: function () {
        return (
            <SampleController
                route={this.props.route}
                archived={true}
            />
        );
    }
});

module.exports = ArchivedSamples;