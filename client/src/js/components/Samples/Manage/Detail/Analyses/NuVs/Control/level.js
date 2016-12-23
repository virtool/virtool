var _ = require("lodash");
var React = require("react");
var Button = require("react-bootstrap/lib/Button");
var Icon = require('virtool/js/components/Base/Icon');

var Level = React.createClass({

    handleClick: function () {
        this.props.ascend();
    },

    render: function () {

        var path = ["Viruses"];

        if (this.props.virusName) {
            path.push(this.props.virusName);

            if (this.props.isolateName) {
                path.push(this.props.isolateName);
            }
        }

        path = path.join(" > ");

        return (
            <div className="path-bar">
                <div className="path-bar-label">
                    Level
                </div>
                <div className="path-bar-content">
                    {path}
                </div>
                <div className="path-bar-up" onClick={this.handleClick}>
                    <Icon name='caret-left' />
                </div>
            </div>
        );
    }
});

module.exports = Level;