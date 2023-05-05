import {Col, Form, Row} from "react-bootstrap";

import {Button} from 'react-bootstrap';
import React, {useEffect, useState} from "react";
import {useNavigate} from "react-router";
import {getSolidDataset, getStringNoLocale, getThing} from "@inrupt/solid-client";
import {useSession} from "@inrupt/solid-ui-react";
import {DCTERMS} from "@inrupt/lit-generated-vocab-common";
import {getScoreDocument, getScoresForUser} from "../util/clara";

interface ScoreOption {
    name: string,
    description?: string,
    url: string
}

const scores: ScoreOption[] = [
    {
        name: "Beethoven_Op53_HenleUrtext_1",
        description: "Sonata Op. 53, Movement 1 by Ludwig van Beethoven, encoding of Henle Urtext edition, 1976, Plate HN1034",
        url: "https://raw.githubusercontent.com/trompamusic-encodings/Beethoven_Op53_HenleUrtext/master/Beethoven_Op53_1-HenleUrtext.mei"
    },
    {
        name: "Beethoven_WoO57_BreitkopfHaertel",
        description: "Andante favori in F major, WoO 57 by Ludwig van Beethoven, encoding of Breitkopf und Härtel edition, 1862–90. Plate B.192.",
        url: "https://raw.githubusercontent.com/trompamusic-encodings/Beethoven_WoO57_BreitkopfHaertel/master/Beethoven_WoO57-Breitkopf.mei"
    },
    {
        name: "Beethoven_WoO71_BreitkopfHaertel",
        description: "12 Variations on the Russian Dance 'Das Waldmädchen', WoO 71 by Ludwig van Beethoven, encoding of Breitkopf und Härtel edition, 1862–90. Plate B.170.",
        url: "https://raw.githubusercontent.com/trompamusic-encodings/Beethoven_WoO71_BreitkopfHaertel/master/Beethoven_WoO71-Breitkopf.mei"
    },
    {
        name: "Beethoven_Op119_BreitkopfHaertel",
        description: "11 Bagatelles, Opus 119 by Ludwig van Beethoven, encoding of Breitkopf und Härtel edition, 1862–90. Plate B.189.",
        url: "https://raw.githubusercontent.com/trompamusic-encodings/Beethoven_Op119_BreitkopfHaertel/master/Beethoven_Op119_Nr01-Breitkopf.mei"
    },
    {
        name: "Beethoven_Op89_BreitkopfHaertel",
        description: "Polonaise, Opus 89 by Ludwig van Beethoven, encoding of Breitkopf und Härtel edition, 1862–90. Plate B.188.",
        url: "https://raw.githubusercontent.com/trompamusic-encodings/Beethoven_Op89_BreitkopfHaertel/master/Beethoven_Op89-BreitkopfHaertel.mei"
    },
    {
        name: "Beethoven_WoO64_BreitkopfHaertel",
        description: "Six variations on a Swiss song, WoO64 by Ludwig van Beethoven, encoding of Breitkopf und Härtel edition, 1862–90. Plate B.177.",
        url: "https://raw.githubusercontent.com/trompamusic-encodings/Beethoven_WoO64_BreitkopfHaertel/master/Beethoven_WoO64-Breitkopf.mei"
    }
]

/**
 * A list of options where a user can choose which score to perform
 */
export default function ScoreSelector() {
    const [userUrl, setUserUrl] = useState('');
    const [userScores, setUserScores] = useState<ScoreOption[]>([]);
    let navigate = useNavigate();
    const {session} = useSession();


    const loadUrl = (url: string) => {
        navigate(`/add?url=${url}`);
    };

    const getMetadataForScore = async (url: string): Promise<ScoreOption> => {
        const doc = await getScoreDocument(url, session.fetch);
        const name = getStringNoLocale(doc!, DCTERMS.title) ?? "unknown";
        return {name, url}
    }

    useEffect(() => {
        let ignore = false;

        async function fetchExistingScores() {
            const urls = await getScoresForUser(session.info.webId!, session.fetch);
            Promise.all(urls.map( (u) => {
                return getMetadataForScore(u)
            })).then(results => {
                if (!ignore) {
                    setUserScores(results)
                }
            });
        }
        if (session.info.isLoggedIn) {
            fetchExistingScores().catch(console.error);
            return () => {
                ignore = true;
            };
        }
    }, [session]);

    return <Row>
        <Col sm={2}/>
        <Col>
            <p>&nbsp;</p>
            <h2>Load a score</h2>
            <h3>Use a score from the Trompa Encodings repository</h3>
            <ul>
                {scores.map((score) => {
                    return (
                        <li key={score.url}>
                            <a
                                href={`/add?url=${score.url}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    loadUrl(score.url);
                                }}
                            >
                                {score.name}
                            </a>
                        </li>
                    );
                })}
            </ul>
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
                    <Col sm={11}>
                        <Form.Control
                            type="input"
                            placeholder="Enter URL"
                            value={userUrl}
                            onChange={(e) => setUserUrl(e.target.value)}
                        />
                    </Col>
                    <Col>
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
                {userScores.map((score) => {
                    return (
                        <li key={score.url}>
                            <a
                                href={`/perform?container=${score.url}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    loadUrl(score.url);
                                }}
                            >
                                {score.name}
                            </a>
                        </li>
                    );
                })}
            </ul>
        </Col>
        <Col sm={2}/>
    </Row>;
}
