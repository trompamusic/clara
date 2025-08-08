import { Col, Form, Row } from "react-bootstrap";

import { Button } from "react-bootstrap";
import { BiLinkExternal, BiEdit } from "react-icons/bi";

import React, { useState } from "react";
import { useNavigate } from "react-router";
import { useClaraScore, useClaraScoresForUser } from "../util/clara";

import _scores from "../scores.json";
const scores = _scores as ScoreOption[];

interface ScoreUrl {
  name: string;
  url: string;
}

interface ScoreOption {
  name: string;
  description?: string;
  html_url?: string;
  urls: ScoreUrl[];
}

function SingleScore({ score }: { score: string }) {
  const { scoreData, isLoading } = useClaraScore(score);
  const navigate = useNavigate();
  const url = score;
  return !isLoading && scoreData ? (
    <>
      <a
        href={`/perform?score=${url}`}
        onClick={(e) => {
          e.preventDefault();
          navigate(`/perform?score=${url}`);
        }}
      >
        {scoreData?.title}
      </a>
      &nbsp;&nbsp;
      <small>
        <a
          href={`/editscore?score=${url}`}
          className="icon-edit"
          onClick={(e) => {
            e.preventDefault();
            navigate(`/editscore?score=${url}`);
          }}
        >
          edit
          <BiEdit />
        </a>
      </small>
    </>
  ) : (
    <span>Loading...</span>
  );
}

/**
 * A list of options where a user can choose which score to perform
 */
export default function ScoreSelector() {
  const [userUrl, setUserUrl] = useState("");
  const navigate = useNavigate();

  const { scores: userScores, isLoading: loadingScores } =
    useClaraScoresForUser();

  const loadUrl = (url: string) => {
    navigate(`/add?url=${url}`);
  };

  return (
    <Row>
      <Col sm={2} />
      <Col>
        <p>&nbsp;</p>
        <h2>Load a score</h2>
        <h3>Use a score from the Trompa Encodings repository</h3>
        <div className="list-group">
          {scores.map((score) => {
            return (
              <div className="list-group-item" key={score.html_url}>
                <h5>{score.name}</h5>
                <p>{score.description}</p>
                <ul>
                  {score.urls.map((url) => {
                    return (
                      <li key={url.url}>
                        <a
                          href={`/add?url=${url.url}`}
                          onClick={(e) => {
                            e.preventDefault();
                            loadUrl(url.url);
                          }}
                        >
                          {url.name || score.name}
                        </a>
                        &nbsp;&nbsp;
                        <small>
                          <a
                            href={`https://mei-friend.mdw.ac.at/?file=${url.url}`}
                            className="icon-link"
                            target="_blank"
                            rel="noreferrer"
                          >
                            mei-friend
                            <BiLinkExternal />
                          </a>
                        </small>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
        <p>or</p>
        <h3>Load an MEI URL</h3>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            if (userUrl && userUrl !== "") {
              loadUrl(userUrl);
            }
          }}
        >
          <Row>
            <Col>
              <Form.Control
                type="input"
                placeholder="Enter URL"
                value={userUrl}
                onChange={(e) => setUserUrl(e.target.value)}
              />
            </Col>
            <Col xs="auto">
              <Button
                variant="primary"
                type="submit"
                onClick={() => {
                  if (userUrl && userUrl !== "") {
                    loadUrl(userUrl);
                  }
                }}
              >
                Load
              </Button>
            </Col>
          </Row>
        </Form>
        <p>or</p>
        <h3>Load a previous score that you have performed</h3>
        <ul>
          {loadingScores && <li>Loading...</li>}
          {userScores?.map((score) => {
            return (
              <li key={score["@id"]}>
                <SingleScore score={score["@id"]} />
              </li>
            );
          })}
          {!loadingScores && userScores?.size === 0 && (
            <li>No scores yet... Load one above</li>
          )}
        </ul>
      </Col>
      <Col sm={2} />
    </Row>
  );
}
