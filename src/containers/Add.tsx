// Add a new score
import {useSearchParams} from "react-router-dom";
import React, {useEffect} from "react";
import { useSolidAuth } from "@ldo/solid-react";
import Api from "../util/api";
import {getScoreDocument, getScoresForUser} from "../util/clara";
import {useNavigate} from "react-router";

export default function Add() {
    let [searchParams] = useSearchParams();
    const { session, fetch } = useSolidAuth();
    const url = searchParams.get('url');
    const navigate = useNavigate();

    // If a resource parameter exists, request to the server to create a container in the pod
    useEffect(() => {
        if (session.isLoggedIn && url) {
            let ignore = false;

            getScoresForUser(session.webId!, fetch).then(scores => {
                scores.filter(score_url => {
                    return getScoreDocument(score_url, fetch).then(doc => {
                        // TODO: Get score document and check if it's the same as the one we're trying to add
                    })
                })


                Api.addScore(
                    url, session.webId!
                ).then(data => {
                    if (!ignore) {
                        navigate(`/addwait?task=${data.task_id}`);
                    }
                });
            })

            return () => {
                ignore = true;
            };
        }
    }, [url, fetch, session.isLoggedIn, session.webId, navigate]);


    if (!session.isLoggedIn) {
        return <p>You must be logged in</p>
    }

    if (!url) {
        return <p>Error: You need to specify the "url" param</p>
    }

    return <p>
        Loading {url}
    </p>
}
