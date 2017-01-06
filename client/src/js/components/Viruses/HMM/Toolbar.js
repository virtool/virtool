/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HMMToolbar
 */

import React from "react";
import { Dropdown, MenuItem, FormGroup, InputGroup, FormControl } from "react-bootstrap";
import { Icon, Flex, FlexItem } from "virtool/js/components/Base";

/**
 * A toolbar component rendered at the top of the virus manager table. Allows searching of viruses by name and
 * abbreviation. Includes a button for creating a new virus.
 */
export default class HMMToolbar extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            canModify: dispatcher.user.permissions.modify_hmm
        };
    }

    static propTypes = {
        findTerm: React.PropTypes.string,
        setFindTerm: React.PropTypes.func.isRequired
    };

    componentDidMount () {
        this.inputNode.focus();
        dispatcher.user.on("change", this.onUserChange);
    }

    componentWillUnmount () {
        dispatcher.user.off("change", this.onUserChange);
    }

    onUserChange = () => {
        this.setState({
            canModify: dispatcher.user.permissions.modify_hmm
        });
    };

    handleChange = (event) => {
        this.props.setFindTerm(event.target.value);
    };

    handleSelect = (eventKey) => {
        dispatcher.router.setExtra([eventKey]);
    };

    render () {

        const mayImport = dispatcher.db.hmm.count() === 0;

        return (
            <div style={{ marginBottom: "15px" }}>
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
                                    placeholder="Definition, cluster, family"
                                    onChange={this.handleChange}
                                    value={this.props.findTerm}
                                />
                            </InputGroup>
                        </FormGroup>
                    </FlexItem>

                    <FlexItem shrink={0} grow={0} pad>
                        <Dropdown id="hmm-dropdown" pullRight onSelect={this.handleSelect}>
                            <Dropdown.Toggle noCaret>
                                <Icon name="menu" />
                            </Dropdown.Toggle>
                            <Dropdown.Menu>
                                <MenuItem eventKey="import" disabled={!this.state.canModify || !mayImport}>
                                    <Icon name="new-entry" /> Import Annotations
                                </MenuItem>
                                <MenuItem eventKey="files" disabled={!this.state.canModify}>
                                    <Icon name="folder-open" /> View Files
                                </MenuItem>
                            </Dropdown.Menu>
                        </Dropdown>
                    </FlexItem>
                </Flex>
            </div>
        );
    }

}
