import React from "react";
import { connect } from "react-redux";
import { bindActionCreators, Dispatch } from "redux";
import { postAnnotation } from "meld-clients-core/lib/actions/index";

interface SubmitButtonProps {
  submitUri: string;
  submitHandler: (args: any) => any;
  submitHandlerArgs?: any;
  buttonContent?: React.ReactNode;
  onResponse?: (response: any) => void;
  disabled?: boolean;
}

interface DispatchProps {
  postAnnotation: (
    submitUri: string,
    motivation: string,
    body: any,
    target: string,
    callback: (response: any) => void,
  ) => void;
}

type Props = SubmitButtonProps & DispatchProps;

const SubmitButton: React.FC<Props> = ({
  submitUri,
  submitHandler,
  submitHandlerArgs = {},
  buttonContent = "Submit",
  onResponse,
  disabled,
  postAnnotation,
}) => {
  const defaultOnResponse = (resp: any) => {
    console.log("Received response: ", resp);
  };

  const post = () => {
    postAnnotation(
      submitUri,
      "",
      submitHandler(submitHandlerArgs),
      "",
      typeof onResponse === "function" ? onResponse : defaultOnResponse,
    );
  };

  if (disabled) {
    return (
      <div className="selectable-score-postButton disabled">
        {buttonContent}
      </div>
    );
  }

  return (
    <div className="selectable-score-postButton" onClick={post}>
      {buttonContent}
    </div>
  );
};

const mapStateToProps = () => ({});

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps =>
  bindActionCreators({ postAnnotation }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(SubmitButton);
