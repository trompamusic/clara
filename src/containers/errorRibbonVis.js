import React, { Component } from 'react';

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
      insertedNotesByScoretime: {}
    }
    this.errorRibbonSvg = React.createRef();
    this.contextualiseInsertedNotes = this.contextualiseInsertedNotes.bind(this);
    this.averageScoretime = this.averageScoretime.bind(this);
    this.closestValidNote = this.closestValidNote.bind(this);
  }

  componentDidMount() {
    console.log("error ribbon visualisation mounted with props ", this.props);
  }

  componentDidUpdate(prevProps, prevState) { 
   // if(//Object.keys(prevProps.timemapByNoteId) < Object.keys(this.props.timemapByNoteId) ||
      //"instantsByScoretimeLastModified" in prevProps &&
     // prevProps.instantsByScoretimeLastModified !== this.props.instantsByScoretimeLastModified) { 
      // initial load, or page has flipped. (Re-)calculate inserted note contexts.
    if(prevProps.latestScoreUpdateTimestamp < this.props.latestScoreUpdateTimestamp) {
      this.contextualiseInsertedNotes();
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

  closestValidNote(candidates) { 
    return candidates.find( (instant) => 
      this.props.ensureArray(instant["http://purl.org/vocab/frbr/core#embodimentOf"])
        .filter( (el) => !(el["@id"].startsWith("https://terms.trompamusic.eu/maps#inserted")) )
        .length > 0
    )
  }

  contextualiseInsertedNotes() {
    // For inserted notes, we have a performance time but no score time. 
    // In order to place them in our ribbon we need to approximate a score time.
    // To do this, look for neighbouring "correctly performed" notes for hints.
    let contextualisedInsertedNotes = {};
    let insertedNotesByScoretime = {};
    this.props.timelinesToVis.forEach( (tl, ix) => { 
      if("inserted" in this.props.performanceErrors[tl]) { // we have inserted notes
        // ensure ALL performed instants (correct and inserted notes) are sorted by time
        const orderedInstants = this.props.instantsByPerfTime[tl].slice(0).sort( (a, b) =>  {
          const instantTimeStringA = a["http://purl.org/NET/c4dm/timeline.owl#at"];
          const instantTimeA = parseFloat(instantTimeStringA.substr(1, instantTimeStringA.length-2));
          const instantTimeStringB = b["http://purl.org/NET/c4dm/timeline.owl#at"];
          const instantTimeB = parseFloat(instantTimeStringB.substr(1, instantTimeStringB.length-2));
          return instantTimeA - instantTimeB;
        });
        // locate the inserted notes within their performance context
        const insertedWithIndices = this.props.performanceErrors[tl].inserted.map( (inserted) => { 
          return {
            index: orderedInstants.findIndex( (instant) => instant["http://purl.org/NET/c4dm/timeline.owl#at"] === 
                                 inserted["http://purl.org/NET/c4dm/timeline.owl#at"]
                  ),
            instant: inserted
          }
        }) 
        contextualisedInsertedNotes[tl] = insertedWithIndices.map((inserted) => { 
          let averageScoretime;
          const validNotesAtIndex = this.props.ensureArray(inserted.instant["http://purl.org/vocab/frbr/core#embodimentOf"])
            .filter((el) => !(el["@id"].startsWith("https://terms.trompamusic.eu/maps#inserted")))
          if(validNotesAtIndex.length) { 
            // if there is a non-inserted note at that index, use its score time
            averageScoretime = this.averageScoretime(validNotesAtIndex);
          } else{
            // otherwise, approximate a score time based on preceding and succeeding non-inserted notes
            let closestValidPredecessorNotes = [];
            let closestValidSuccessorNotes = [];
            const predecessors = orderedInstants.slice(0, inserted.index-1).reverse();
            const closestValidPredecessorInstant = this.closestValidNote(predecessors);
            if(closestValidPredecessorInstant) { 
              closestValidPredecessorNotes = this.props.ensureArray(closestValidPredecessorInstant["http://purl.org/vocab/frbr/core#embodimentOf"])
              .map((embodiment) => embodiment["@id"])
              .filter((id) => !(id.startsWith("https://terms.trompamusic.eu/maps#inserted")));
            }
            const successors = orderedInstants.slice(inserted.index+1);
            const closestValidSuccessorInstant= this.closestValidNote(successors);
            if(closestValidSuccessorInstant) { 
              closestValidSuccessorNotes = this.props.ensureArray(closestValidSuccessorInstant["http://purl.org/vocab/frbr/core#embodimentOf"])
                .map((embodiment) => embodiment["@id"])
                .filter((id) => !(id.startsWith("https://terms.trompamusic.eu/maps#inserted")));
            }
            averageScoretime = this.averageScoretime([...closestValidPredecessorNotes, ...closestValidSuccessorNotes]);
          }
          inserted["approxScoretime"] = averageScoretime;
          return inserted;
        })
      }
      insertedNotesByScoretime[tl] = Object.keys(contextualisedInsertedNotes[tl]).map((n) => {
        return { [contextualisedInsertedNotes[tl][n].approxScoretime]: contextualisedInsertedNotes[tl][n].instant }
      })
    });
    this.setState({insertedNotesByScoretime});
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
            this.props.performanceErrors[tl].deleted.forEach((d) => {
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
              let predecessorNoteElementXPositions = [];
              let successorNoteElementXPositions = [];
              const inserted = this.state.insertedNotesByScoretime[tl].find( (note) => Object.keys(note)[0] === scoretimeOfInsertedOnPage);
              const predecessors = orderedScoretimesOnPage.slice(0, scoretimeOfInsertedOnPage).reverse();
              const closestPredecessorScoretime = predecessors.find((p) => p.qstamp <= scoretimeOfInsertedOnPage);
              const successors = orderedScoretimesOnPage.slice(scoretimeOfInsertedOnPage);
              const closestSuccessorScoretime = successors.find((p) => p.qstamp >= scoretimeOfInsertedOnPage);
              if(closestPredecessorScoretime && closestPredecessorScoretime.qstamp in this.props.instantsByScoretime[tl]) { 
                predecessorNoteElementXPositions = this.props.instantsByScoretime[tl][closestPredecessorScoretime.qstamp]
                  .map( (instant) => this.props.noteElementsForInstant(instant) ).flat()
                  .map( (noteElement) => this.props.convertCoords(noteElement).x )
              }
              if(closestSuccessorScoretime && closestSuccessorScoretime.qstamp in this.props.instantsByScoretime[tl]) { 
                successorNoteElementXPositions = this.props.instantsByScoretime[tl][closestSuccessorScoretime.qstamp]
                  .map( (instant) => this.props.noteElementsForInstant(instant) ).flat()
                  .map( (noteElement) => this.props.convertCoords(noteElement).x )
              }
              const contextNoteElementXPositions = [...predecessorNoteElementXPositions, ...successorNoteElementXPositions]
              if(!contextNoteElementXPositions.length) { 
                console.log("Error Ribbon: Found inserted note with no valid note context: ", inserted);
                return; 
              } else { 
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

      svgElements = [...svgElements, ...deletedNoteIndicators, ...insertedNoteIndicators];
      return(
        <svg id="errorRibbon" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width={this.state.width} height={this.state.height} transform="scale(1,-1) translate(0, 50)" ref = { this.errorRibbonSvg }>
              { svgElements }
        </svg>
      )
    } else { return ( <div id="errorRibbonLoading" >Rendering error ribbon visualisation...</div> ) }
  }
}
