
var React = require('react');

var SamplesTable = require("./SamplesTable.jsx");

var View = React.createClass({

    render: function () {
        return (
            <SamplesTable
                route={this.props.route}
                archived={false}
            />
        );
    }
});

module.exports = View;
