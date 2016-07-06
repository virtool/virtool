var React = require('react');

var ListGroupItem = require('virtool/js/components/Base/PushListGroupItem.jsx');

var Report = React.createClass({

    render: function () {

        var dlStyle = {
            marginLeft: '-90px'
        };

        return (
            <ListGroupItem>
                <h5>{_.capitalize(this.props.definition)}</h5>

                <dl className='dl-horizontal' style={dlStyle}>
                    <dt>Score</dt>
                    <dd>
                        {this.props.best_score}
                        <small><em>  {this.props.full_score}</em></small>
                    </dd>

                    <dt>E-value</dt>
                    <dd>
                        {this.props.best_e}
                        <small><em>  {this.props.full_e}</em></small>
                    </dd>

                    <dt>Bias</dt>
                    <dd>
                        {this.props.best_bias}
                        <small><em>  {this.props.full_bias}</em></small>
                    </dd>

                    <dt>Families</dt>
                    <dd>{_.without(Object.keys(this.props.families), 'None').join(', ')}</dd>
                </dl>
            </ListGroupItem>
        );
    }

});

module.exports = Report;