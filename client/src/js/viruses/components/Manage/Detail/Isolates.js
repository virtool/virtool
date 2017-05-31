/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * exports Isolates
 */

import React from "react";
import { map, difference, findIndex, find } from "lodash";
import { Row, Col } from "react-bootstrap";

import SequenceList from "./Sequences/List";
import IsolateList from "./IsolateList";

/**
 * The isolate editor component that contains child components for viewing and editing isolates and sequences associated
 * with the virus.
 *
 * @class
 */
export default class Isolates extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            activeIsolateId: this.props.data.length > 0 ? this.props.data[0].isolate_id: null
        };
    }

    static propTypes = {
        virusId: React.PropTypes.string.isRequired,
        data: React.PropTypes.array.isRequired,
        canModify: React.PropTypes.bool
    };

    componentWillReceiveProps = (nextProps) => {
        // In this case the active isolate has been removed (only the active isolate shows a remove icon), the
        // activeIsolateId has to changed before the removal is rendered.
        if (nextProps.data.length > 0 && nextProps.data.length < this.props.data.length) {
            // Find the id of the removed isolate.
            const removedId = difference(
                map(this.props.data, "isolate_id"),
                map(nextProps.data, "isolate_id")
            )[0];

            // Find the index of the remove isolate in the current unupdated set of isolates.
            const removedIndex = findIndex(this.props.data, {isolate_id: removedId});

            // Set state such that the active isolate is the one before the isolate.
            this.selectIsolate(this.props.data[removedIndex - 1].isolate_id);
        }
    };

    componentDidUpdate = (prevProps) => {
        if (prevProps.data !== this.props.data) {
            // A new isolate was added.
            if (this.props.data.length > 0 && this.props.data.length > prevProps.data.length) {
                const lastIsolate = this.props.data[this.props.data.length - 1];
                this.setState({activeIsolateId: lastIsolate.isolate_id});
            }

            // Only one isolate is present.
            if (this.props.data.length === 1) {
                this.setState({activeIsolateId: this.props.data[0].isolate_id});
            }

            // No isolates are associated with the sample.
            if (this.props.data.length === 0) {
                this.setState({activeIsolateId: null});
            }
        }
    };

    selectIsolate = (isolateId) => this.setState({activeIsolateId: isolateId});

    /**
     * Toggle whether an add-isolate form should be shown. Triggered by clicking the add-isolate button or by cancelling
     * the add-isolate form.
     *
     * @func
     */
    toggleAdding = () => {
        let newActiveIsolateId = "new";

        if (this.state.activeIsolateId === "new") {
            if (this.props.data.length > 0) {
                newActiveIsolateId = this.props.data[0].isolate_id;
            }
            if (this.props.data.length === 0) {
                newActiveIsolateId = null;
            }
        }

        this.selectIsolate(newActiveIsolateId);
    };

    render () {

        const sharedProps = {
            virusId: this.props.virusId,
            activeIsolateId: this.state.activeIsolateId,
            canModify: this.props.canModify
        };

        // Get the entire active isolate document.
        const activeIsolate = find(this.props.data, {isolate_id: this.state.activeIsolateId});

        // Get the array of sequences from the isolate.
        const sequenceData = activeIsolate && activeIsolate.hasOwnProperty("sequences") ? activeIsolate.sequences: [];

        return (
            <div className="clearfix">
                <Row>
                    <Col md={4}>
                        <IsolateList
                            {...sharedProps}
                            selectIsolate={this.selectIsolate}
                            toggleAdding={this.toggleAdding}
                            data={this.props.data}
                        />
                    </Col>
                    <Col md={8}>
                        <SequenceList
                            {...sharedProps}
                            isolateId={this.state.activeIsolateId}
                            data={sequenceData}
                        />
                    </Col>
                </Row>
            </div>
        );
    }

}
