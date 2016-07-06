var React = require('react');
var Input = require('react-bootstrap/lib/Input');

var ListGroupItem = require('virtool/js/components/Base/PushListGroupItem.jsx');

var Icon = require('virtool/js/components/Base/Icon.jsx');

var ORFItem = React.createClass({

    render: function () {

        var icon = (
            <Icon
                name={(this.props.strand === 1 ? 'plus': 'minus') + '-square'}
                bsStyle={this.props.strand === 1 ? 'primary': 'danger'}
            />
        );
        
        return (
            <ListGroupItem>
                <h5>{this.props.frame} {icon} ORF {this.props.index}.{this.props.orf_index}</h5>
                <Input type='textarea' value={this.props.pro} className='sequence' readOnly />
            </ListGroupItem>
        );
    }

});

module.exports = ORFItem;