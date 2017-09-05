import React, { PropTypes } from "react";
import { connect } from "react-redux";
import { ListGroup, Label, Panel } from "react-bootstrap";

import { getSoftwareUpdates } from "../actions";
import { ListGroupItem } from "../../components/Base/ListGroupItem";

class SoftwareUpdateViewer extends React.Component {

    constructor (props) {
        super(props);
    }

    static propTypes = {
        updates: PropTypes.object,
        onGet: PropTypes.func
    };

    componentDidMount () {
        this.props.onGet();
    }

    render () {

        if (this.props.updates === null) {
            return <div />;
        }

        const releaseComponents = this.props.updates.releases.map(release =>
            <ListGroupItem key={release.name}>
                <Label>{release.name}</Label>
            </ListGroupItem>
        );

        return (
            <div>
                <Panel header="Software Updates">
                    <ListGroup fill>
                        {releaseComponents}
                    </ListGroup>
                </Panel>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        updates: state.updates.software
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onGet: () => {
            dispatch(getSoftwareUpdates());
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(SoftwareUpdateViewer);

export default Container;
