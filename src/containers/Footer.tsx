import React from "react"
import {Nav} from "react-bootstrap";
import {Link} from "react-router-dom";

export default function Footer() {
    return <footer className="d-flex flex-wrap justify-content-between align-items-center py-3 my-4 border-top">
        <div className="col-md-8 d-flex align-items-center">
            <a href="http://iwk.mdw.ac.at/?PageId=140" target="_blank" rel="noopener noreferrer">More information</a>
        </div>
        <div className="col-md-8 d-flex align-items-center">
            <img alt="Flag of the European Union" src="/static/eu-flag.jpg" width="100px"/>
            <div style={ {marginLeft: "20px", fontSize: "0.8em"} }>
                This project has received funding from the&nbsp;European Union's Horizon 2020 research and innovation programme<i>&nbsp;</i><em>H2020-EU.3.6.3.1. - Study European heritage, memory, identity, integration and cultural interaction and translation, including its representations in cultural and scientific collections, archives and museums, to better inform and understand the present by richer interpretations of the past</em> under grant agreement No 770376.
            </div>
        </div>
        <div className="col-md-8 d-flex align-items-center">
            <ul className="col-md-4 d-flex align-items-center list-unstyled">
                <li className="ms-3">
                    <a href={"https://trompamusic.eu/"} target={"_blank"} rel={"noopener noreferrer"}>
                        <img src="/static/trompa.png" id="trompaLogo" alt="TROMPA Project logo" />
                    </a>
                </li>
            </ul>
            <ul className="nav col-md-4 justify-content-end list-unstyled d-flex">
                <li className="ms-3">
                    <a href="http://www.mdw.ac.at/">
                        <img src="/static/mdw.svg" id="mdwLogo" alt="University of Music and Performing Arts Vienna, Austria logo" />
                    </a>
                </li>
            </ul>
        </div>


    </footer>

}
