
var React = require('react');

var SamplesTable = require("virtool/js/components/Main/samples/SamplesTable.jsx");

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
