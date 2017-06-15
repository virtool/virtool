import { connect } from "react-redux";

import React from "react";
import { ListGroup } from "react-bootstrap";

import { findSamples } from "../actions";
import { Icon, ListGroupItem } from "virtool/js/components/Base";
import SampleEntry from "./Entry";
import SampleToolbar from "./Toolbar";

class SamplesList extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            term: ""
        };
    }

    static propTypes = {
        samples: React.PropTypes.arrayOf(React.PropTypes.object),
        findSamples: React.PropTypes.func
    };

    componentDidMount () {
        if (this.props.samples === null) {
            this.props.findSamples(this.state.term);
        }
    }

    render () {

        let sampleComponents;

        if (this.props.samples && this.props.samples.length) {
            sampleComponents = this.props.samples.map(document =>
                <SampleEntry
                    key={document.sample_id}
                    sampleId={document.sample_id}
                    userId={document.user_id}
                    {...document}
                />
            );
        } else {
            sampleComponents = (
                <ListGroupItem key="noSample" className="text-center">
                    <Icon name="info"/> No samples found.
                </ListGroupItem>
            );
        }

        return (
            <div>
                <SampleToolbar />

                <ListGroup>
                    {sampleComponents}
                </ListGroup>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        samples: state.samples.list
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        findSamples: (term) => {
            dispatch(findSamples(term));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(SamplesList);

export default Container;
