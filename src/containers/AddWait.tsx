// Add a new score
import { useSearchParams } from "react-router-dom";
import React, { useEffect, useState } from "react";
import Api from "../util/api";
import useSWR from "swr";
import { useNavigate } from "react-router";

/**
 * We're adding a score to the user's pod and waiting for the backend
 * process to complete. When done, redirect to the page for this score.
 * If the status task reports an error, show it and stop waiting.
 */
export default function AddWait() {
  const fetcher = (url: string) => Api.swrQuery(url);
  const [error, setError] = useState<string | null>(null);

  let [searchParams] = useSearchParams();
  const task = searchParams.get("task");
  const navigate = useNavigate();

  const { data, error: queryError } = useSWR(
    task && !error ? `/api/add/status?task=${task}` : null,
    fetcher,
    { refreshInterval: 1000 },
  );

  useEffect(() => {
    if (data && data.status === "ok") {
      navigate(`/perform?score=${data.container}`);
    } else if (data && data.status === "pending") {
    } else if (data) {
      setError(data.error);
    } else if (queryError) {
      setError(queryError);
    }
  }, [data, navigate, queryError]);

  if (error) {
    return <p>Error when waiting: {error}</p>;
  }
  return <p>Loading...</p>;
}
