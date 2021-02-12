import React, { Component } from 'react';
import ReactDOM from 'react-dom'

const defaultY = 80; // for edge-case of only-one-note-on-page
const padding = 0.1; // proportion of ribbon reserved for whitespace
const errorIndicatorHeight = 20; // currently in pixels -- perhaps make a proportion instead?

export default class ErrorRibbonVis extends Component {
  constructor(props) {
    super(props);
    this.state = {
      width: this.props.width || "1280",
      height: this.props.height || "120",
      pointsPerTimeline: {}
    }
    this.errorRibbonSvg = React.createRef();
  }

  componentDidMount() {
    console.log("error ribbon visualsiation mounted with props ", this.props);
  }

  render() {
    if(Object.keys(this.props.timemapByNoteId).length) { 
      let svgElements = [];
      let deletedNoteIndicators = [];
      let insertedNoteIndicators = [];
      // generate barlines
      Array.from(this.props.barlinesOnPage).forEach((bl,ix) => {
        const absolute = this.props.convertCoords(bl);
        svgElements.push(
          this.props.makeLine(
            "barLineAttr", // className,
            null, // qstamp - barlines don't need one!
            null, // timeline - barlines don't need one!
            absolute.x, "0", absolute.x, this.state.height, // x1, y1, x2, y2
            "barline-"+ix, // react key
            null  // titleString - barlines don't need one!
          )
        )
      })

      const errorLineSpacing = (this.state.height * (1-padding)) / this.props.timelinesToVis.length;
      
      this.props.timelinesToVis.slice(0).sort().forEach( (tl, ix) => { 
        let className = tl === this.props.currentTimeline ? "currentTl" : "";
        // draw lines to represent each performance timeline
        const timelineY = (errorLineSpacing * ix+1) + (this.state.height * padding);
        console.log("timeline Y: ", timelineY);
        svgElements.push(
          this.props.makeLine(
            "timelineMarker", // className
            null, // qstamp - timelineMarker doesn't need one!
            tl["@id"], // timeline 
            "0", timelineY, this.state.width, timelineY, // x1, y1, x2, y2
            "error-vis-timeline-" + ix, // reactKey
            tl["@id"] // title string
          )
        )
        // draw any errors (deleted or inserted notes)
        if(tl in this.props.performanceErrors) { 
          if("deleted" in this.props.performanceErrors[tl]) {
            // this timeline has deleted notes
            this.props.performanceErrors[tl].deleted.filter((d) => {
              const deletedNoteIds = this.props.ensureArray(d).map((e) => 
                e["@id"].substr(e["@id"].indexOf("#")+1)
              )
              // are any of them on the current page?
              const deletedNotesOnPage = Array.from(this.props.notesOnPage).filter( (noteOnPage) =>  
                deletedNoteIds.includes(noteOnPage.getAttribute("id"))
              )
              deletedNoteIndicators = [
                ...deletedNotesOnPage.map( (noteElement) => {
                  const noteCoords = this.props.convertCoords(noteElement);
                  console.log("Note element: ", noteElement, this.props.timemapByNoteId);
                  return this.props.makeRect(
                    className + " deleted",
                    this.props.timemapByNoteId[noteElement.getAttribute("id")].qstamp,
                    tl, // timeline
                    // delete indicators sit underneath the line (ref. y- and height-calculation below)
                    noteCoords.x, timelineY - errorIndicatorHeight, noteCoords.x2 - noteCoords.x, errorIndicatorHeight,  // x, y, width, height
                    "deleted-"+tl+noteElement["@id"], // react key
                    "deleted point in timeline " + tl
                  )
                }), 
                ...deletedNoteIndicators
              ]
            })
          }
          if("inserted" in this.props.performanceErrors[tl]) { 
            // this timeline has inserted notes
          }
        }
      })

      svgElements = [...svgElements, ...deletedNoteIndicators, ...insertedNoteIndicators];
      return(
        <svg id="errorRibbon" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width={this.state.width} height={this.state.height} transform="scale(1,-1) translate(0, 50)" ref = { this.errorRibbonSvg }>
              { svgElements }
        </svg>
      )
    } else { return ( <div id="errorRibbonLoading" >Rendering error ribbon visualisation...</div> ) }
  }
}
