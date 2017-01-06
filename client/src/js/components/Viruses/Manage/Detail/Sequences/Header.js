/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SequenceHeader
 */

import React from "react";
import FlipMove from "react-flip-move"
import { Flex, FlexItem } from "virtool/js/components/Base";

/**
 * The header that is always shown at the top of a Sequence component. Displays the sequence accession and definition
 * and icons for managing the Sequence component"s state. Icons are passed in as children.
 *
 * @class
 */
export default class SequenceHeader extends React.PureComponent {

    static propTypes = {
        sequenceId: React.PropTypes.string,
        definition: React.PropTypes.string,
        children: React.PropTypes.node.isRequired
    };

    /**
     * Stop further propagation of the passed event. Triggered in response to clicking icon buttons. Stops the click
     * from triggering events on the Sequence component.
     *
     * @param event {object} - the click event to stop.
     * @func
     */
    stopPropagation = (event) => {
        event.stopPropagation();
    };

    render () {
        return (
            <h5 className="disable-select">
                <Flex>
                    <FlexItem grow={1} shrink={0}>
                        <strong>{this.props.sequenceId || "Accession"}</strong>
                        <span> - {this.props.definition || "Definition"}</span>
                    </FlexItem>
                    <FlexItem>
                        <FlipMove
                            typeName="div"
                            className="icon-group"
                            leaveAnimation={false}
                            duration={150}
                            onClick={this.stopPropagation}
                        >
                            {this.props.children}
                        </FlipMove>
                    </FlexItem>
                </Flex>
            </h5>
        );
    }
}
