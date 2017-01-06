/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * exports IsolateList
 */

import React from "react";
import FlipMove from "react-flip-move"
import { Badge } from "react-bootstrap";
import { Icon, ListGroupItem, Scroll } from "virtool/js/components/Base";


import Isolate from "./Isolate";
import IsolateAdd from "./IsolateAdd";

const getInitialState = () => ({
    restrictSourceTypes: dispatcher.settings.get("restrict_source_types"),
    allowedSourceTypes: dispatcher.settings.get("allowed_source_types")
});

/**
 * A component that lists the isolates associated with a virus as Isolate components.
 *
 * @class
 */
export default class IsolateList extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        data: React.PropTypes.array.isRequired,

        virusId: React.PropTypes.string,
        activeIsolateId: React.PropTypes.string,
        restrictSourceTypes: React.PropTypes.bool,
        allowedSourceTypes: React.PropTypes.array,
        canModify: React.PropTypes.bool,

        toggleAdding: React.PropTypes.func,
        selectIsolate: React.PropTypes.func
    };

    componentDidMount () {
        dispatcher.settings.on("change", this.update);
        this.flipMoveNode.addEventListener("resize", this.updateScroll);
    }

    componentWillUnmount () {
        dispatcher.settings.off("change", this.update);
        this.flipMoveNode.removeEventListener("resize", this.updateScroll);
    }

    updateScroll = () => {
        this.scrollNode.update();
    };

    update = () => {
        this.setState(getInitialState());
    };

    render () {

        // Render each isolate as a selectable list item
        const isolateComponents = this.props.data.map((isolate) => {
            return (
                <div key={isolate.isolate_id}>
                    <Isolate
                        virusId={this.props.virusId}
                        isolateI={isolate.isolate_id}
                        sourceName={isolate.source_name}
                        sourceType={isolate.source_name}
                        default={isolate.default}
                        active={isolate.isolate_id === this.props.activeIsolateId}
                        selectIsolate={this.props.selectIsolate}
                        canModify={this.props.canModify}
                        {...this.state}
                    />
                </div>
            );
        });

        // The final list item can display either an "New Isolate" button or a form for adding a new isolate
        let lastComponent;

        // If the "addingIsolate" prop is true, render the form. Otherwise display a button to open the form.
        if (this.props.canModify) {
            lastComponent = (
                <IsolateAdd
                    key="last"
                    virusId={this.props.virusId}
                    default={this.props.data.length === 0}
                    active={this.props.activeIsolateId === "new"}
                    toggleAdding={this.props.toggleAdding}
                    {...this.state}
                    canModify={this.props.canModify}
                    updateScroll={this.updateScroll}
                />
            );
        }

        if (!this.props.canModify && isolateComponents.length === 0) {
            lastComponent = (
                <ListGroupItem key="last">
                    <div className="text-center">
                        <Icon name="info" /> No isolates found.
                    </div>
                </ListGroupItem>
            );
        }

        const flipProps = {
            typeName: "div",
            className: "list-group",
            enterAnimation: "fade",
            leaveAnimation: false,
            duration: 150
        };

        return (
            <div>
                <h5>
                    <strong><Icon name="lab" /> Isolates</strong> <Badge>{this.props.data.length}</Badge>
                </h5>
                <Scroll ref={(node) => this.scrollNode = node} style={{marginBottom: "15px"}}>
                    <FlipMove
                        {...flipProps}
                        style={{marginBottom: 0, marginRight: "10px"}}
                        onFinishAll={this.updateScroll}
                    >
                        {isolateComponents}
                        {lastComponent}
                    </FlipMove>
                </Scroll>
            </div>
        );
    }

}
