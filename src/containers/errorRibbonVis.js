import React, { Component } from 'react';
import { closestClef} from '../util/util';

const padding = 0.1; // proportion of ribbon reserved for whitespace
const errorIndicatorHeight = 20; // currently in pixels -- perhaps make a proportion instead?
const insertedNoteWidth = 12; // in pixels: width of inserted note indicator

export default class ErrorRibbonVis extends Component {
  constructor(props) {
    super(props);
    this.state = {
      width: this.props.width || "1280",
      height: this.props.height || "120",
      pointsPerTimeline: {},
      insertedNotesByScoretime: {},
      loading: false,
      worker: new window.Worker("/workers/errorRibbonWorker.js")
    }
    this.errorRibbonSvg = React.createRef();
    this.contextualiseInsertedNotes = this.contextualiseInsertedNotes.bind(this);
    this.averageScoretime = this.averageScoretime.bind(this);
    this.determineInsertedNoteYPosition = this.determineInsertedNoteYPosition.bind(this);
  }

  componentDidMount() {
    console.log("error ribbon visualisation mounted with props ", this.props);
    //this.props.setErrorRibbonReady(false);
    
  }

  componentDidUpdate(prevProps, prevState) { 
   // if(//Object.keys(prevProps.timemapByNoteId) < Object.keys(this.props.timemapByNoteId) ||
      //"instantsByScoretimeLastModified" in prevProps &&
     // prevProps.instantsByScoretimeLastModified !== this.props.instantsByScoretimeLastModified) { 
      // initial load, or page has flipped. (Re-)calculate inserted note contexts.
    if(prevProps.latestScoreUpdateTimestamp !== this.props.latestScoreUpdateTimestamp) {
      this.setState({loading: true}, this.contextualiseInsertedNotes);
    }
  }

  averageScoretime(noteURIs) { 
    // given a list of note elements, calculate their average scoretime
    const noteIds = noteURIs.map((n) => n.substr(n.indexOf("#")+1));
    const knownNotes = noteIds.filter((n) => 
      Object.keys(this.props.timemapByNoteId).includes(n)
    )
    if(knownNotes.length) { 
      // return average scoretime (qstamp)
      return knownNotes.map((n) => this.props.timemapByNoteId[n].qstamp)
        .reduce( (sum, scoretime) => 
          sum + scoretime
        ) / knownNotes.length
    } else { 
      console.warn("Attempting to calculate average scoretime without known notes: ", noteIds);
    }
  }

  pitchToNum(pitchName) {
    let nameToNum;
    switch(pitchName) { 
      case "C": 
        nameToNum = 0;
        break;
      case "Cs":
      case "Db": 
        nameToNum = 1;
        break;
      case "D":
        nameToNum = 2;
        break;
      case "Ds":
      case "Eb":
        nameToNum = 3;
        break;
      case "E":
        nameToNum = 4;
        break;
      case "F": 
        nameToNum = 5;
        break;
      case "F#":
      case "Gb":
        nameToNum = 6;
        break;
      case "G":
        nameToNum = 7;
        break;
      case "Gs":
      case "Ab":
        nameToNum = 8;
        break;
      case "A":
        nameToNum = 9;
        break;
      case "As":
      case "Bb":
        nameToNum = 10;
        break;
      case "B": 
        nameToNum = 11;
        break;
      default: 
        console.error("pitchToNum called with unrecognised pitch name:", pitchName)
    }
    return nameToNum;
  }

  octaveDiff(pitchOct, clef) {
    let clefOct;
    switch(clef.dataset.shape) { 
      case "F": 
        clefOct = 3;
        break;
      case "G": 
      case "C":
        clefOct = 4;
        break;
      default:
        console.error("octaveDiff called on clef with unhandled shape: ", clef);
    }
    return (pitchOct - clefOct) * 12
  }

  contextualiseInsertedNotes() {
    // For inserted notes, we have a performance time but no score time. 
    // In order to place them in our ribbon we need to approximate a score time.
    // To do this, look for neighbouring "correctly performed" notes for hints.
    this.state.worker.postMessage({
      timelinesToVis: this.props.timelinesToVis,
      performanceErrors: this.props.performanceErrors,
      instantsByPerfTime: this.props.instantsByPerfTime,
      timemapByNoteId: this.props.timemapByNoteId
    });
    this.state.worker.onerror = (err) => err;
    this.state.worker.onmessage = (e) => { 
      console.log("Received from worker: ", e);
      this.setState({insertedNotesByScoretime: e.data, loading:false});
    }
  }

  determineInsertedNoteYPosition(clef, inserted) {
    const staff = clef.closest(".staff");
    const lines = document.querySelectorAll("#" + staff.getAttribute("id") + "> path").reverse();
    const interLineDistance = lines[1] - lines[0];
    // take the heightOfOrigin to be the Y position of the clef's 'line'
    const heightOfOrigin = lines[0] + (cleff.dataset.line * interLineDistance);
    // figure out semitone difference from inserted note to origin
    const insertedPitch = this.props.ensureArray(inserted["http://purl.org/vocab/frbr/core#embodimentOf"])[0]["@id"].replace("https://terms.trompamusic.eu/maps#inserted_", "");
    insertedPitchComponents = /([A-G])([sb]?)(\d)/.exec(insertedPitch);
    const insertedPitchName = insertedPitchComponents[1];
    const insertedPitchAccid = insertedPitchComponents[2];
    const insertedPitchOct = insertedPitchComponents[3];
    const semitoneDiff = pitchToNum(insertedPitchName + insertedPitchAccid) - pitchToNum(clef.dataset.shape) + octaveDiff(insertedPitchOct, clef.dataset.shape);
    console.log("Got : ", clef.dataset.shape, clef.dataset.line, lines, inserted, insertedPitch);

  }

  render() {
    // FIXME: Move all dom-based calculation OUTSIDE OF RENDER FUNCTION 
    if(!(this.state.loading) && Object.keys(this.props.timemapByNoteId).length) { 
      let svgElements = [];
      let inpaintElements = [];
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
        const timelineY = (errorLineSpacing * ix+1) + 2*(this.state.height * padding);
        svgElements.push(
          this.props.makeLine(
            className + " timelineMarker", // className
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
            this.props.ensureArray(this.props.performanceErrors[tl].deleted).forEach((d) => {
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
                  return this.props.makeRect(
                    className + " deleted",
                    this.props.timemapByNoteId[noteElement.getAttribute("id")].qstamp,
                    tl, // timeline
                    // delete indicators sit underneath the line (ref. y- and height-calculation below)
                    noteCoords.x, timelineY - errorIndicatorHeight*.8, noteCoords.x2 - noteCoords.x, errorIndicatorHeight*.8,  // x, y, width, height
                    "deleted-"+tl+noteElement.getAttribute("id"), // react key
                    "deleted point in timeline " + tl
                  )
                }), 
                ...deletedNoteIndicators
              ]
            })
          }
          if("inserted" in this.props.performanceErrors[tl] && tl in this.state.insertedNotesByScoretime) { 
            // figure out whether there are inserted notes on this page
            // heuristic: figure out scoretime (qstamp) of "first" (top-left) and "last" (bottom-right) 
            // note element on page.  Render any inserted notes with approximate scoretimes in this range
            const positionSortedNoteElements = Array.from(this.props.notesOnPage).slice(0).sort( (a, b) => 
              a.getBoundingClientRect().x - b.getBoundingClientRect().x || 
              a.getBoundingClientRect().y - b.getBoundingClientRect().y
            );
            const minPageScoretime = this.props.timemapByNoteId[positionSortedNoteElements[0].getAttribute("id")].qstamp;
            const maxPageScoretime = this.props.timemapByNoteId[positionSortedNoteElements[positionSortedNoteElements.length - 1].getAttribute("id")].qstamp;
            const scoretimesOfInsertedOnPage = this.state.insertedNotesByScoretime[tl].filter( (t) => Object.keys(t)[0] >= minPageScoretime && Object.keys(t)[0] <= maxPageScoretime )
            // for the inserted notes on page, find the closest predecessor and successor scoretimes and calculate their corresponding note elements' avg X positions
            const orderedScoretimesOnPage = this.props.timemap.filter( (t) => t.qstamp >= minPageScoretime && t.qstamp <= maxPageScoretime ).sort()
            insertedNoteIndicators = [ ...insertedNoteIndicators, ...scoretimesOfInsertedOnPage.map( (t, ix) => { 
              if(Object.keys(t).length > 1) { 
                console.warn("Found scoretime of inserted on page with more than one key: ", t)
              }
              const scoretimeOfInsertedOnPage = Object.keys(t)[0];
              let predecessorNoteElements = [];
              let predecessorNoteElementXPositions = [];
              let successorNoteElements = [];
              let successorNoteElementXPositions = [];
              const inserted = this.state.insertedNotesByScoretime[tl].find( (note) => Object.keys(note)[0] === scoretimeOfInsertedOnPage);
              const closestPredecessorScoretime = orderedScoretimesOnPage.slice(0).reverse().find((p) => p.qstamp <= scoretimeOfInsertedOnPage);
              const closestSuccessorScoretime = orderedScoretimesOnPage.find((p) => p.qstamp >= scoretimeOfInsertedOnPage);
              if(closestPredecessorScoretime && closestPredecessorScoretime.qstamp in this.props.instantsByScoretime[tl]) { 
                predecessorNoteElements = this.props.instantsByScoretime[tl][closestPredecessorScoretime.qstamp]
                  .map( (instant) => this.props.noteElementsForInstant(instant) ).flat()
                predecessorNoteElementXPositions = predecessorNoteElements
                  .map( (noteElement) => this.props.convertCoords(noteElement).x )
              }
              if(closestSuccessorScoretime && closestSuccessorScoretime.qstamp in this.props.instantsByScoretime[tl]) { 
                successorNoteElements = this.props.instantsByScoretime[tl][closestSuccessorScoretime.qstamp]
                  .map( (instant) => this.props.noteElementsForInstant(instant) ).flat()
                successorNoteElementXPositions = successorNoteElements
                  .map( (noteElement) => this.props.convertCoords(noteElement).x )
              }
              const contextNoteElements = [...predecessorNoteElements, ...successorNoteElements]
              const contextNoteElementXPositions = [...predecessorNoteElementXPositions, ...successorNoteElementXPositions]
              if(!contextNoteElementXPositions.length || !closestPredecessorScoretime) { 
                console.log("Error Ribbon: Found inserted note with no valid note context: ", inserted);
                return ""; 
              } else { 
                if(tl === this.props.currentTimeline) { 
                  // determine closest clef for purposes of inpainting error:
                  const clef = closestClef(contextNoteElements[0].getAttribute("id"));
                  this.determineInsertedNoteYPosition(clef, inserted);
                  if(!!clef) { 
                    const contextNoteCoords = this.props.convertCoords(contextNoteElements[0]);
                    
                    inpaintElements = [...inpaintElements, this.props.makePoint(
                      className + " inpainted",
                      closestPredecessorScoretime.qstamp,
                      tl,
                      contextNoteCoords.x,
                      contextNoteCoords.y,
                      20,
                      20,
                      "inpainted-" + inserted[scoretimeOfInsertedOnPage]["@id"] + "-" + ix,
                      "inpainted point in timeline " + tl,
                      () => this.props.handleClickSeekToInstant(inserted[scoretimeOfInsertedOnPage]["http://purl.org/NET/c4dm/timeline.owl#at"])
                    )]
                  }
                }
                const xPos = contextNoteElementXPositions.reduce( (sum, x) => sum + x, 0 ) / contextNoteElementXPositions.length;
                return this.props.makeRect(
                  className + " inserted",
                  closestPredecessorScoretime.qstamp, 
                  tl, 
                  xPos, timelineY, insertedNoteWidth, errorIndicatorHeight*.8,
                  "inserted-" + inserted[scoretimeOfInsertedOnPage]["@id"] + "-" + ix,
                  "inserted point in timeline " + tl,
                  () => this.props.handleClickSeekToInstant(inserted[scoretimeOfInsertedOnPage]["http://purl.org/NET/c4dm/timeline.owl#at"])
                )
              }
            })]
          }
        }
      })
      
      // set up positioning for inpaint SVG
      const scoreComponentBoundingRect = this.props.scoreComponent.current.getBoundingClientRect(); 
      const inpaintSvgStyle = {
        position: "absolute",
        top: scoreComponentBoundingRect.top + window.scrollY + "px",
        left: scoreComponentBoundingRect.left + window.scrollX + "px",
        height: scoreComponentBoundingRect.height
      }
      svgElements = [...svgElements, ...deletedNoteIndicators, ...insertedNoteIndicators];
      return(
        <div>
          <svg id="errorRibbon" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width={this.state.width} height={this.state.height} transform="scale(1,-1) translate(0, 50)" ref = { this.errorRibbonSvg }>
                { svgElements }
          </svg>
          <svg id="errorInpaint" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width={this.state.width} height={this.state.height} transform="scale(1,-1) translate(0, 50)" style = { inpaintSvgStyle }  ref = { this.errorInpaintSvg }>
                { inpaintElements }
          </svg>
        </div>
      )
    } else { return ( <div id="errorRibbonLoading" /> ) }
  }
}
