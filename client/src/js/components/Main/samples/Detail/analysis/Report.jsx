var _ = require('lodash');
var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');
var RelativeTime = require('virtool/js/components/Base/RelativeTime.jsx');

var PathoscopeReport = require('./Pathoscope/report.jsx');
var NuVsReport = require('./NuVs/report.jsx');

var AnalysisReport = React.createClass({

    render: function () {

        if (this.props.algorithm === 'pathoscope') {
            content = (
                <PathoscopeReport
                    {...this.props}
                />
            );
        }

        if (this.props.algorithm === 'nuvs') {
            content = (
                <NuVsReport
                    {...this.props}
                />
            )
        }

        return (
            <div>
                <ListGroup>
                    <ListGroupItem>
                        <Row>
                            <Col sm={3}>
                                {this.props.comments || 'Unnamed Analysis'}
                            </Col>
                            <Col sm={3} >
                                {this.props.algorithm === 'nuvs' ? 'NuVs': _.capitalize(this.props.algorithm)}
                            </Col>
                            <Col md={2}>
                                Index v{this.props.index_version}
                            </Col>
                            <Col md={4}>
                                Created <RelativeTime time={this.props.timestamp} /> by {this.props.username}
                                <Icon name='arrow-back' onClick={this.props.onBack} pullRight />
                            </Col>
                        </Row>
                    </ListGroupItem>
                </ListGroup>

                {content}
            </div>
        );
    }

});

module.exports = AnalysisReport;