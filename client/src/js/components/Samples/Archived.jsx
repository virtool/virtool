var React = require('react');

var SamplesTable = require("virtool/js/components/Main/Samples/SamplesTable.jsx");

var View = React.createClass({

    render: function () {
        return (
            <SamplesTable
                collection={dispatcher.collections.samples}
                archived={true}
            />
        );
    }
});

module.exports = View;
