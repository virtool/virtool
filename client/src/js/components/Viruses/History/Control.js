/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HistoryControl
 */

import React from "react";
import { FormGroup, InputGroup, FormControl } from "react-bootstrap";
import { Flex, FlexItem, Icon } from "virtool/js/components/Base";

/**
 * A control bar that is shown above the history documents. Allows searching for changes in a particular virus and for
 * filtering changes by the index they were included in.
 *
 * @class
 */
export default class HistoryControl extends React.Component {

    static propTypes = {
        indexVersions: React.PropTypes.array,
        selectedVersion: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.number]),
        onFilter: React.PropTypes.func
    };

    componentDidMount () {
        this.inputNode.focus();
    }

    selectIndex = (event) => {
        dispatcher.router.setExtra([event.target.value]);
    };

    render () {

        const optionComponents = this.props.indexVersions.map(indexVersion => (
            <option key={indexVersion} value={indexVersion}>
                {indexVersion === "unbuilt" ? "Unbuilt Changes": "Version " + indexVersion}
            </option>
        ));

        return (
            <Flex>
                <FlexItem grow={1}>
                    <FormGroup>
                        <InputGroup>
                            <InputGroup.Addon>
                                <Icon name="search" /> Find
                            </InputGroup.Addon>
                            <FormControl
                                inputRef={(node) => this.inputNode = node}
                                type="text"
                                onChange={this.props.onFilter}
                                placeholder="Virus Name"
                            />
                        </InputGroup>
                    </FormGroup>
                </FlexItem>
                <FlexItem pad>
                    <FormGroup>
                        <InputGroup>
                            <InputGroup.Addon>
                                <Icon name="hammer" /> Index
                            </InputGroup.Addon>
                            <FormControl
                                componentClass="select"
                                onChange={this.selectIndex}
                                value={this.props.selectedVersion}
                            >
                                {optionComponents}
                            </FormControl>
                        </InputGroup>
                    </FormGroup>
                </FlexItem>
            </Flex>
        );
    }
}
