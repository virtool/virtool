var React = require('react');
var Dropzone = require('react-dropzone');
var SampleController = require("./Controller.jsx");

var ManageSamples = React.createClass({

    propTypes: {
        route: React.PropTypes.object
    },

    getInitialState: function () {
        return {
            documents: dispatcher.db.files.chain()
        };
    },

    componentDidMount: function () {
        dispatcher.db.files.on("change", this.update);
    },

    componentWillUnmount: function () {
        dispatcher.db.files.off("change", this.update);
    },

    update: function () {
        this.setState(this.getInitialState());
    },

    render: function () {

        console.log(this.state.documents.branch().find({file_type: "reads"}).data())

        return (
            <div>
                Test
            </div>
        );
    }

});

module.exports = ManageSamples;
