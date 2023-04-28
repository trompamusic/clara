import {Col, Form, Row} from "react-bootstrap";

import {Button} from 'react-bootstrap';
import React, {useState} from "react";
import {useNavigate} from "react-router";

interface ScoreOption {
    name: string,
    description: string,
    url: string
}

const scores: ScoreOption[] = [
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
    let navigate = useNavigate();

    const loadUrl = (url: string) => {
        navigate(`/perform?resource=${url}`);
    };

    return <Row>
            <Col sm={2} />
            <Col>
                <p>&nbsp;</p>
                <h2>Load a score</h2>
                <h3>Use a score from the Trompa Encodings repository</h3>
                <ul>
                    {scores.map((score) => {
                        return (
                            <li key={score.url}>
                                <a
                                    href={`/perform?resource=${score.url}`}
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
                ... todo
            </Col>
            <Col sm={2} />
        </Row>;
}
