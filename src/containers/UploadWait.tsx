// Add a new score
import { useSearchParams } from "react-router-dom";
import React, { useEffect, useState } from "react";
import Api from "../util/api";
import useSWR from "swr";
import { useNavigate } from "react-router";

export default function UploadWait() {
  const fetcher = (url: string) => Api.swrQuery(url);

  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const task = searchParams.get("task");
  const score = searchParams.get("score");
  const navigate = useNavigate();

  const { data, error: queryError } = useSWR(
    task && !error ? `/api/align/status?task=${task}` : null,
    fetcher,
    { refreshInterval: 1000 },
  );

  useEffect(() => {
    if (data && data.status === "ok") {
      window.open(`/perform?score=${score}`, "_self");
    } else if (data) {
      setError(data.error);
    } else if (queryError) {
      setError(queryError);
    }
  }, [data, queryError, score]);

  if (error) {
    return (
      <div>
        <p>Error when processing performance: {error}</p>
        <p>
          <a
            href={`/perform?score=${score}`}
            onClick={() => navigate(`/perform?score=${score}`)}
          >
            Go back to the score
          </a>
        </p>
      </div>
    );
  }

  return <p>Processing your performance...</p>;
}
