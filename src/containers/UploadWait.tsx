// Add a new score
import {useSearchParams} from "react-router-dom";
import React, {useEffect} from "react";
import Api from "../util/api";
import useSWR from "swr";
import {useNavigate} from "react-router";

/**
 * We're adding a score to the user's pod and waiting for the backend
 * process to complete. When done, redirect to the page for this score
 */
export default function UploadWait() {
    const fetcher = (url: string) => Api.swrQuery(url);

    let [searchParams, setSearchParams] = useSearchParams();
    const task = searchParams.get('task');
    const score = searchParams.get('score');
    const navigate = useNavigate();

    const { data, error } = useSWR(task ? `/align/status?task=${task}` : null, fetcher, { refreshInterval: 1000 })

    useEffect(() => {
        if (data && data.status === "ok") {
            window.open(`/perform?score=${score}`, '_self')
            //navigate(`/perform?score=${score}`);
        }
    }, [data, score]);

    return <p>Loading...</p>
}
