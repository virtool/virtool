import React from "react";
import { get } from "lodash-es";
import { connect } from "react-redux";
import { Panel } from "react-bootstrap";

import { getSoftwareUpdates } from "../../updates/actions";
import { Icon } from "../../base";

class Welcome extends React.Component {

    componentDidMount () {
        this.props.onGet();
    }

    render () {
        let version;



        if (this.props.version) {
            version = (
                <small className="text-muted">
                    {this.props.version}
                </small>
            );
        }
        return (
            <div className="container">
                <Panel>
                    <Panel.Body>
                        <h3>Virtool {version}</h3>
                        <p>Viral infection diagnostics using next-generation sequencing</p>

                        <a
                            className="btn btn-default"
                            href="http://www.virtool.ca/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Icon name="globe" /> Website
                        </a>
                    </Panel.Body>
                </Panel>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    version: get(state.updates.software, "version")
});

const mapDispatchToProps = (dispatch) => ({

    onGet: () => {
        dispatch(getSoftwareUpdates());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(Welcome);
