/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AnalysisItem
 */

import React from "react";
import CX from "classnames";
import { upperFirst, camelCase } from "lodash-es";
import { Row, Col, ProgressBar } from "react-bootstrap";
import { Icon, RelativeTime } from "virtool/js/components/Base";

export default class AnalysisItem extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            disabled: false,
            progress: this.props.ready ? 0: dispatcher.db.jobs.findOne({_id: this.props.job}).progress
        };
    }

    static propTypes = {
        _id: React.PropTypes.string.isRequired,
        name: React.PropTypes.string,
        job: React.PropTypes.string.isRequired,
        algorithm: React.PropTypes.string.isRequired,
        index_version: React.PropTypes.number.isRequired,
        timestamp: React.PropTypes.string.isRequired,
        username: React.PropTypes.string.isRequired,
        ready: React.PropTypes.bool,
        selectAnalysis: React.PropTypes.func,
        setProgress: React.PropTypes.func,
        canModify: React.PropTypes.bool
    };
    
    componentDidMount () {
        if (!this.props.ready) {
            dispatcher.db.jobs.on("update", this.onJobUpdate);
        }
    }

    componentDidUpdate (prevProps) {
        if (!prevProps.ready && this.props.ready) {
            dispatcher.db.jobs.off("update", this.onJobUpdate);
        }
    }
    
    componentWillUnmount () {
        if (!this.props.ready) {
            dispatcher.db.jobs.off("update", this.onJobUpdate);
        }
    }

    /**
     * Makes detailed information for this analysis document visible. Triggered by clicking this component.
     *
     * @func
     */
    handleClick = () => {
        if (!this.disabled && this.props.ready) {
            this.props.selectAnalysis(this.props._id);
        }
    };

    /**
     * Remove an analysis record by sending a request to the server. Triggered by a click event on the red trashcan
     * icon.
     *
     * @func
     */
    remove = () => {
        this.setState({pending: true}, () => {

            this.setState({
                disabled: true
            }, this.props.setProgress(true));

            dispatcher.db.analyses.request("remove_analysis", {_id: this.props._id})
                .success(() => this.props.setProgress(false))
                .failure(() => this.props.setProgress(false));
        });
    };

    onJobUpdate = () => {
        const job = dispatcher.db.jobs.findOne({_id: this.props.job});

        if (job.progress !== this.state.progress) {
            this.setState({progress: job.progress});
        }
    };

    render () {

        let removeIcon;

        if (this.props.canModify && this.props.ready && !this.state.disabled) {
            removeIcon = <Icon
                name="remove"
                bsStyle="danger"
                onClick={this.remove}
                pullRight
            />
        }

        let progressBar;

        if (!this.props.ready) {
            progressBar = (
                <ProgressBar
                    className="progress-small"
                    bsStyle={this.props.ready ? "primary": "success"}
                    now={this.props.ready ? 100: this.state.progress * 100}
                />
            );
        }

        const itemClass = CX({
            "list-group-item": true,
            "disabled": this.state.disabled || !this.props.ready,
            "hoverable": !this.state.disabled && this.props.ready
        });

        return (
            <div className={itemClass} onClick={this.handleClick}>

                {progressBar}

                <Row>
                    <Col sm={3}>
                        {this.props.name || "Unnamed Analysis"}
                    </Col>
                    <Col sm={3} >
                        {this.props.algorithm === "nuvs" ? "NuVs": upperFirst(camelCase(this.props.algorithm))}
                    </Col>
                    <Col md={2}>
                        Index v{this.props.index_version}
                    </Col>
                    <Col md={4}>
                        Created <RelativeTime time={this.props.timestamp} /> by {this.props.username}
                        {removeIcon}
                    </Col>
                </Row>
            </div>
        );
    }
}
