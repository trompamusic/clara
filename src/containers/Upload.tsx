import {useSearchParams} from "react-router-dom";
import React, {useEffect, useState} from "react";
import {useSession} from "@inrupt/solid-ui-react";
import UploadDropzone from "./UploadDropzone";

export default function Upload() {
    let [searchParams, setSearchParams] = useSearchParams();
    const {session} = useSession();
    const score = searchParams.get('score');

    if (!session.info.isLoggedIn) {
        return <p>You must be logged in</p>
    }

    if (!score) {
        return <p>Error: You need to specify the "score" param</p>
    }

    return <UploadDropzone score={score} />
}