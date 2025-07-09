import {useSearchParams} from "react-router-dom";
import React from "react";
import {useSolidAuth} from "@ldo/solid-react";
import UploadDropzone from "./UploadDropzone";

export default function Upload() {
    let [searchParams] = useSearchParams();
    const {session} = useSolidAuth();
    const score = searchParams.get('score');

    if (!session.isLoggedIn) {
        return <p>You must be logged in</p>
    }

    if (!score) {
        return <p>Error: You need to specify the "score" param</p>
    }

    return <UploadDropzone score={score} />
}
