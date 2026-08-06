import React from "react";
import { FileRejection, useDropzone } from "react-dropzone";

interface MidiFileUploadProps {
  disabled: boolean;
  onFileAccepted: (file: File) => void;
  onReject: (message: string) => void;
}

function rejectionMessage(rejections: FileRejection[]): string {
  const code = rejections[0]?.errors[0]?.code;
  switch (code) {
    case "file-too-large":
      return "That file is too large — 5MB at most.";
    case "too-many-files":
      return "Drop a single file.";
    default:
      return "Only MIDI files (.mid, .midi) can be uploaded.";
  }
}

const MidiFileUpload: React.FC<MidiFileUploadProps> = ({
  disabled,
  onFileAccepted,
  onReject,
}) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    disabled,
    accept: { "audio/midi": [".mid", ".midi"] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    onDropAccepted: (files) => onFileAccepted(files[0]),
    onDropRejected: (rejections) => onReject(rejectionMessage(rejections)),
  });

  return (
    <div
      {...getRootProps({
        className: `border rounded p-4 text-center text-muted${
          isDragActive ? " border-primary" : ""
        }`,
        style: { cursor: "pointer" },
      })}
    >
      <input {...getInputProps()} />
      {isDragActive
        ? "Drop the MIDI file here"
        : "Drag a .mid file here, or click to choose one"}
    </div>
  );
};

export default MidiFileUpload;
