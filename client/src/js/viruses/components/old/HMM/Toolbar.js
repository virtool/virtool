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
import { FormGroup, InputGroup, FormControl } from "react-bootstrap";
import { Icon } from "virtool/js/components/Base";

export default class HMMToolbar extends React.Component {

    constructor (props) {
        super(props);
    }

    static propTypes = {
        findTerm: PropTypes.string,
        setFindTerm: PropTypes.func.isRequired
    };

    render = () => (
        <div className="toolbar">
            <FormGroup>
                <InputGroup>
                    <InputGroup.Addon>
                        <Icon name="search" /> Find
                    </InputGroup.Addon>
                    <FormControl
                        inputRef={(node) => this.inputNode = node}
                        type="text"
                        placeholder="Definition, cluster, family"
                        onChange={(event) => this.props.setFindTerm(event.target.value)}
                        value={this.props.findTerm}
                    />
                </InputGroup>
            </FormGroup>
        </div>
    );
}
