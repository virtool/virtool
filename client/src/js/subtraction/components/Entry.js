/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HostEntry
 */

import React from "react";
import { pick } from "lodash";
import { Flex, FlexItem, ListGroupItem, ProgressBar }from "virtool/js/components/Base";

/**
 * A component that serves as an document row in the hosts table.
 */
export default class HostEntry extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            progress: this.getProgress()
        };
    }

    static propTypes = {
        _id: React.PropTypes.string,
        added: React.PropTypes.bool,
        ready: React.PropTypes.bool,
        showModal: React.PropTypes.func,
    };

    componentDidMount () {
        if (this.state.progress !== 1) {
            dispatcher.db.jobs.on("update", this.onJobChange);
        }
    }

    shouldComponentUpdate (nextProps, nextState) {
        return this.props.ready !== nextProps.ready || this.state.progress != nextState.progress;
    }

    componentDidUpdate (prevProps, prevState) {
        if (prevState.progress < 1 && this.state.progress === 1) {
            dispatcher.db.jobs.off("update", this.onJobChange);
        }
    }

    componentWillUnmount () {
        dispatcher.db.jobs.off("update", this.onJobChange);
    }

    onJobChange = () => {
        this.setState({
            progress: this.getProgress()
        });
    };

    getProgress = () => {
        if (this.props.added) {
            return 1;
        }

        const document = dispatcher.db.jobs.findOne({_id: this.props._id});

        return document ? document.progress : 0;
    };

    /**
     * Triggers showing a modal with details about the host associated with the document. Triggered by clicking the
     * document.
     *
     * @func
     */
    handleClick = () => {
        this.props.showModal(pick(this.props, ["_id"]));
    };

    render () {

        let progressBar;

        if (this.state.progress !== 1) {
            progressBar = <ProgressBar now={this.state.progress * 100} affixed />
        }

        return (
            <ListGroupItem onClick={this.handleClick} disabled={!this.props.added}>
                {progressBar}
                <Flex>
                    <FlexItem grow={1}>
                        {this.props._id}
                    </FlexItem>
                </Flex>
            </ListGroupItem>
        );
    }
}
