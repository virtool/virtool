import React, { PropTypes } from "react";
import { Modal } from "react-bootstrap";
import { AlgorithmSelect, Button } from "virtool/js/components/Base";

const getInitialState = () => ({
    algorithm: "pathoscope_bowtie"
});

export default class CreateAnalysis extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        show: PropTypes.bool,
        sampleId: PropTypes.string,
        onSubmit: PropTypes.func
    };

    handleSubmit = (event) => {
        event.preventDefault();
        this.props.onSubmit(this.props.sampleId, this.state.algorithm);
        this.onHide();
    };

    render = () => (
        <Modal show={this.props.show} onHide={this.props.onHide} onExited={() => this.setState(getInitialState())}>
            <Modal.Header>
                New Analysis
            </Modal.Header>
            <form onSubmit={this.handleSubmit}>
                <Modal.Body>
                    <div className="toolbar">
                        <AlgorithmSelect
                            value={this.state.algorithm}
                            onChange={(e) => this.setState({algorithm: e.target.value})}
                        />
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        type="submit"
                        bsStyle="primary"
                        icon="play"
                    >
                        Start
                    </Button>
                </Modal.Footer>
            </form>
        </Modal>
    );
}
