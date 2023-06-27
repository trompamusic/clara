import React, {useCallback} from 'react'
import {useDropzone} from 'react-dropzone'
import {useSession} from "@inrupt/solid-ui-react";
import {useNavigate} from "react-router";
import Api from "../util/api";

export default function UploadDropzone({score} : {score: string}) {
    const {session} = useSession();
    const navigate = useNavigate();
    const webId = session.info.webId ?? "";

    const onDrop = useCallback((acceptedFiles: Blob[]) => {
        acceptedFiles.forEach((file: Blob) => {
            Api.alignMidi(webId, score, file)
                .then((data) => {
                    navigate(`/uploadwait?task=${data.task_id}&score=${score}`);
                })
        })
    }, [navigate, score, webId])
    const {getRootProps, getInputProps} = useDropzone({onDrop})

    if (!session.info.isLoggedIn) {
        return <p>loading...</p>
    }

    return (
        <div {...getRootProps()}>
            <input {...getInputProps()} />
            <p>Drag 'n' drop some files here, or click to select files</p>
        </div>
    )
}
