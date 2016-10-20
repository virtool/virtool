var React = require('react');
var SampleController = require("./Controller.jsx");

var ActiveSamples = React.createClass({

    render: function () {
        return (
            <SampleController
                route={this.props.route}
                archived={false}
            />
        );
    }
});

module.exports = ActiveSamples;
