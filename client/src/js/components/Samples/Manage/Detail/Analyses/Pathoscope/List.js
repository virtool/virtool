import React from "react";
import FlipMove from "react-flip-move"
import { forIn, includes, sortBy, flatten } from "lodash";
import { Button } from 'virtool/js/components/Base';

var PathoscopeEntry = require("./Entry");
var PathoscopeIsolate = require("./Isolate");

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
                    showReads={this.props.showReads}
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
                            showReads={this.props.showReads}
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
                <FlipMove {...flipMoveProps}>
                    {rows}
                </FlipMove>
            </div>
        );
    }

});

module.exports = PathoscopeList;