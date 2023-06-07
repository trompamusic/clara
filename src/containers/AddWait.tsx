// Add a new score
import {useSearchParams} from "react-router-dom";
import React, {useEffect, useState} from "react";
import Api from "../util/api";
import useSWR from "swr";
import {useNavigate} from "react-router";

/**
 * We're adding a score to the user's pod and waiting for the backend
 * process to complete. When done, redirect to the page for this score
 */
export default function AddWait() {
    const fetcher = (url: string) => Api.swrQuery(url);

    let [searchParams, setSearchParams] = useSearchParams();
    const task = searchParams.get('task');
    const navigate = useNavigate();

    const { data, error } = useSWR(task ? `/add/status?task=${task}` : null, fetcher, { refreshInterval: 1000 })

    useEffect(() => {
        if (data.status === "ok") {
            navigate(`/perform?score=${data.container}`);
        }
    }, [data]);

    return <p>Loading...</p>
}
