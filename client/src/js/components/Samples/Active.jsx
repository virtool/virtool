
var React = require('react');

var SamplesTable = require("./SamplesTable.jsx");

var View = React.createClass({

    render: function () {
        return (
            <SamplesTable
                collection={dispatcher.collections.samples}
                archived={false}
            />
        );
    }
});

module.exports = View;
