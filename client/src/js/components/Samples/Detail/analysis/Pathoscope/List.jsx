var _ = require("lodash");
var React = require('react');
var ReactDOM = require('react-dom');
var FlipMove = require('react-flip-move');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Grid = require('react-bootstrap/lib/Grid');
var Panel = require('react-bootstrap/lib/Panel');
var Alert = require('react-bootstrap/lib/Button');
var Button = require('react-bootstrap/lib/Button');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

var PathoscopeEntry = require("./Entry.jsx");
var PathoscopeIsolate = require("./Isolate.jsx");

var PathoscopeList = React.createClass({

    propTypes: {
        data: React.PropTypes.arrayOf(React.PropTypes.object).isRequired
    },

    setScroll: function (virusId, scrollLeft) {
        _.forIn(this.refs, function (ref, key) {
            if (key.split("-")[0] === virusId) {
                ref.scrollTo(scrollLeft);
            }
        });
    },

    render: function () {

        var rows = this.props.data.map(function (item, index) {

            var expanded = _.includes(this.props.expanded, item._id);

            var components = [
                <PathoscopeEntry
                    key={item._id}
                    {...item}
                    toggleIn={this.props.toggleIn}
                    in={expanded}
                />
            ];

            if (expanded) {

                var isolateComponents = _.sortBy(item.isolates, "pi").reverse().map(function (isolate) {
                    return (
                        <PathoscopeIsolate
                            ref={item._id + "-" + isolate.isolate_id}
                            key={isolate.isolate_id}
                            virusId={item._id}
                            maxDepth={item.maxDepth}
                            maxGenomeLength={item.maxGenomeLength}
                            {...isolate}
                            setScroll={this.setScroll}
                        />
                    );
                }, this);

                return components.concat(
                    <div key={index} className="list-group-item pathoscope-virus-detail spaced">
                        {isolateComponents}
                    </div>
                );
            }

            return components;

        }, this);

        rows = _.flatten(rows);

        var flipMoveProps = {
            typeName: "div",
            className: "list-group",
            enterAnimation: "accordianVertical",
            leaveAnimation: false
        };

        return (
            <div style={{overflowY: "hidden"}}>
                <FlipMove ref="flipMove" {...flipMoveProps}>
                    {rows}
                </FlipMove>
            </div>
        );
    }

});

module.exports = PathoscopeList;