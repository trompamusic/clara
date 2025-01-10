import React, { Component } from 'react';
import { connect } from 'react-redux' ;
import { bindActionCreators } from 'redux';
import { postAnnotation } from 'meld-clients-core/lib/actions/index';


class SubmitButton extends Component { 
  constructor(props) { 
    super(props);
    this.post = this.post.bind(this);
    this.defaultOnResponse= this.defaultOnResponse.bind(this);
  }

  defaultOnResponse(resp) { 
    // overwritten if onResponse supplied in props
    console.log("Received response: ", resp)
  }

  post() { 
    let submitHandlerArgs = "submitHandlerArgs" in this.props ? this.props.submitHandlerArgs : {} ;
    this.props.postAnnotation(
      this.props.submitUri,
      "",
      this.props.submitHandler(submitHandlerArgs), 
      "",
      typeof this.props.onResponse === "function" ? this.props.onResponse : this.defaultOnResponse
    )
  }

  render() { 
    const buttonContent = "buttonContent" in this.props
      ? this.props.buttonContent
      : "Submit";
    if("disabled" in this.props) { 
      return (
      <div className="selectable-score-postButton disabled">
        { buttonContent }
      </div>)
    } else { 
      return(
        <div className="selectable-score-postButton" onClick={this.post}>
          { buttonContent }
        </div>
      )
    }
  }
}

function mapStateToProps() { 
  return {}
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators( { 
    postAnnotation,
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(SubmitButton);
