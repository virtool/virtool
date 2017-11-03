/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Welcome
 */

import React from "react";
import { get } from "lodash";
import { connect } from "react-redux";
import { Panel } from "react-bootstrap";

import { getSoftwareUpdates } from "../../updates/actions";
import { Icon } from "../../base";

class Welcome extends React.Component {

    componentDidMount () {
        this.props.onGet();
    }

    render () {
        if (!this.props.version) {
            return <div />;
        }

        return (
            <div className="container">
                <Panel>
                    <h3>Virtool <small className="text-muted">{this.props.version}</small></h3>
                    <p>Viral infection diagnostics using next-generation sequencing</p>

                    <a className="btn btn-default" href="http://www.virtool.ca/" target="_blank"
                       rel="noopener noreferrer">
                        <Icon name="vtlogo"/> Website
                    </a>
                </Panel>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        version: get(state.updates.software, "current_version")
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onGet: () => {
            dispatch(getSoftwareUpdates());
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(Welcome);

export default Container;
