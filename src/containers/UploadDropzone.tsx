import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useSolidAuth } from "@ldo/solid-react";
import { useNavigate } from "react-router";
import Api from "../util/api";

export default function UploadDropzone({ score }: { score: string }) {
  const { session, fetch } = useSolidAuth();
  const navigate = useNavigate();
  const webId = session.webId ?? "";

  const onDrop = useCallback(
    (acceptedFiles: Blob[]) => {
      acceptedFiles.forEach((file: Blob) => {
        Api.alignMidi(webId, score, file).then((data) => {
          navigate(`/uploadwait?task=${data.task_id}&score=${score}`);
        });
      });
    },
    [navigate, score, webId],
  );
  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  if (!session.isLoggedIn) {
    return <p>loading...</p>;
  }

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      <p>Drag 'n' drop some files here, or click to select files</p>
    </div>
  );
}
