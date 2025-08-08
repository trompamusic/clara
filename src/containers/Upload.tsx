import { useSearchParams } from "react-router-dom";
import React from "react";
import { useAuthentication } from "../util/hooks";
import UploadDropzone from "./UploadDropzone";

export default function Upload() {
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading } = useAuthentication();
  const score = searchParams.get("score");

  if (isLoading) {
    return <p>Checking authentication...</p>;
  }

  if (!isAuthenticated) {
    return <p>You must be logged in</p>;
  }

  if (!score) {
    return <p>Error: You need to specify the "score" param</p>;
  }

  return <UploadDropzone score={score} />;
}
