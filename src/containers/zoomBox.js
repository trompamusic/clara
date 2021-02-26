import React, { Component } from 'react';
import ReactDOM from 'react-dom'

const padding = 0.1; // proportion of width/height reserved as whitespace
const maxPointRadius = 40 // radius of point encoding a velocity of 127 (max midi velocity)
const pixelsPerSecond = 1000 // number of pixels per second on x-axis, i.e. time resolution

export default class ZoomBox extends Component {
  constructor(props) {
    super(props);
    this.state = {
      width: this.props.width || "200",
      height: this.props.height || "200"
    }
    this.determineSvgElements = this.determineSvgElements.bind(this);
  }

  componentDidMount() {
    console.log("zoom box mounted with props ", this.props);
  }

  
  determineSvgElements(scoretime, timeline) { 
    const svgElements = [
          <rect x="0" y="0" width={ this.state.width } height={ this.state.height } fill="white"/>
    ]
    if(timeline in this.props.instantsByScoretime &&
       scoretime in this.props.instantsByScoretime[timeline]) { 
      const notesPerformedAtThisScoretime = [];
      this.props.instantsByScoretime[timeline][scoretime].forEach( (instant) => {
        let t = instant["http://purl.org/NET/c4dm/timeline.owl#at"];
        t = parseFloat(t.substr(1, t.length-2));
        if(t > 0) { // skip deleted notes, which are at t = -1
          notesPerformedAtThisScoretime.push(
            this.props.ensureArray(instant["http://purl.org/vocab/frbr/core#embodimentOf"]).map( (e) => {
              const noteId = e["@id"].slice(e["@id"].indexOf("#")+1);
              return { 
                noteId: noteId,
                at: t,
                pname: this.props.noteAttributes[noteId].pname,
                oct: this.props.noteAttributes[noteId].oct,
                velocity: this.props.performedElements[noteId][timeline]
              }
            })
          )
        }
      })
      
      // draw SVG elements for each note performed at this scoretime:
      // determine spacing required to nicely accomodate all on y axis:
      const numNotes = notesPerformedAtThisScoretime.flat().length;
      const verticalSpacing = numNotes 
        ? (this.state.height * (1-padding)) / numNotes
        : 0
      const avgTime = numNotes // avgTime will be used as the centre x-axis point of the zoom box
        ? notesPerformedAtThisScoretime.flat().reduce( (sum, n) => sum + n.at, 0) / numNotes
        : 0

      return notesPerformedAtThisScoretime.flat()
        .sort( (a, b) => 
          // sort first by octave and then by pname
          a.oct - b.oct ||
          a.pname.localeCompare(b.pname, "en-EN")
        ).map((n, ix) => { 
          const zoomBoxElementX = (this.state.width / 2) + (pixelsPerSecond * (n.at - avgTime));
          const zoomBoxElementY = (verticalSpacing * ix+1) + (2 * this.state.height * padding);
          console.log("zoom x: ", zoomBoxElementX, n.at, avgTime);
          return(
            [
              this.props.makeLine(
                "zoomBoxLine",
                scoretime,
                timeline,
                this.state.width*padding, zoomBoxElementY, this.state.width*(1-padding), zoomBoxElementY,
                "zoomBox-line-" + timeline + "-" + scoretime + "-" + ix, // react key
                n.pname + n.oct + " - velocity: " + n.velocity // title string
              ),
              <text 
                key = {"zoomBox-noteLabel" + timeline + "-" + scoretime + "-" + ix}
                className = "zoomBoxLabel"
                transform={ "scale(1, -1)" }
                x={(this.state.width*padding) - 20} y={-1 * zoomBoxElementY}
              > {n.pname + n.oct}
              </text>,
              <text 
                key = {"zoomBox-velocityLabel" + timeline + "-" + scoretime + "-" + ix}
                className = "zoomBoxLabel"
                transform={ "scale(1, -1)" }
                x={this.state.width - (this.state.width*padding)} y={-1 * zoomBoxElementY}
              > { n.velocity}
              </text>,
              this.props.makePoint(
                "zoomBoxPoint",
                scoretime,
                timeline,
                zoomBoxElementX, zoomBoxElementY, // place point relative to average performed-time at centre
                n.velocity / 127 * maxPointRadius, // map velocity to point radius
                n.velocity / 127 * maxPointRadius,
                "zoomBox-point-" + timeline + "-" + scoretime + "-" + ix, // react key
                n.pname + n.oct + " - velocity: " + n.velocity // title string
              )
            ]
          )
        }).flat()
    }
  }

  render() {
    console.log("zoom box rendered with props: ", this.props);
    const svgElements = this.determineSvgElements(this.props.scoretime, this.props.timeline)

    return(
      <div id="zoomBox" style={ { 
        left: this.props.left + 20, 
        top: this.props.top + 20, 
        width: this.state.width + "px",
        height: this.state.height + "px",
        visibility: this.props.visibility
      }}>
        <svg id="zoomBoxSvg" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" 
           width={this.state.width} height={this.state.height} transform="scale(1,-1)"> 
          {svgElements}
        </svg>
      </div>
    )
  }
}
