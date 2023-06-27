import React, {useCallback} from 'react'
import {useDropzone} from 'react-dropzone'
import {useSession} from "@inrupt/solid-ui-react";
import {useNavigate} from "react-router";

export default function UploadDropzone({score} : {score: string}) {
    const {session} = useSession();
    const navigate = useNavigate();
    const webId = session.info.webId ?? "";

    const onDrop = useCallback((acceptedFiles: Blob[]) => {
        acceptedFiles.forEach((file: Blob) => {
            let formData = new FormData();

            formData.append("file", file);
            formData.append("midi_type", "midi");
            formData.append("score", score);
            formData.append("profile", webId);

            fetch('/align', {method: "POST", body: formData}).then((response) => {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error("HTTP Error " + response.status);
                }
            }).then((data) => {
                navigate(`/uploadwait?task=${data.task_id}&score=${score}`);
            });

            //const reader = new FileReader()

            // reader.onabort = () => console.log('file reading was aborted')
            // reader.onerror = () => console.log('file reading has failed')
            // reader.onload = () => {
            //     // Do whatever you want with the file contents
            //     const binaryStr = reader.result
            //     console.log(binaryStr)
            //     let formData = new FormData();
            //
            //     formData.append("file", binaryStr);
            //     formData.append("midi_type", "midi");
            //     formData.append("score_url", score);
            // }
            // reader.readAsBinaryString(file)
        })

    }, [])
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
