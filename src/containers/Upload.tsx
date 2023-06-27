// Add a new score
import {useSearchParams} from "react-router-dom";
import React, {useEffect, useState} from "react";
import {useSession} from "@inrupt/solid-ui-react";
import Api from "../util/api";
import {getScoreDocument, getScoresForUser} from "../util/clara";
import {useNavigate} from "react-router";
import UploadDropzone from "./UploadDropzone";

/**
 * The main wrapper to perform a score
 *
 *  - Takes a score URL as a parameter
 *  - Look at the user's pod to see if they already have this URL in their pod
 *  - If so, redirect to that container
 *  - If not, sends a request to the server to set up the score in the user's pod
 *      (download score, get metadata, run initial script)
 *  - Check the status of this request, once it's done redirect to that container
 * @constructor
 */
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
